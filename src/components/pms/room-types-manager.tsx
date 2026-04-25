'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Building, 
  Plus, 
  Pencil, 
  Trash2, 
  Search,
  Users,
  BedDouble,
  Maximize,
  Loader2,
  DollarSign,
  LayoutGrid,
  List,
  Download,
  Upload,
  MoreVertical,
  Settings,
  Package,
  Eye,
  Sparkles,
  X,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';

// Helper functions for CSV
const escapeCSV = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
};

// Constants
const AMENITY_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'room', label: 'Room' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'view', label: 'View' },
  { value: 'services', label: 'Services' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-emerald-500' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-500' },
];

// Types
interface Amenity {
  id: string;
  name: string;
  icon?: string;
  category: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface Property {
  id: string;
  name: string;
  currency: string;
}

interface WifiPlan {
  id: string;
  name: string;
  speed?: string;
  status: string;
}

interface RoomType {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  description?: string;
  maxAdults: number;
  maxChildren: number;
  maxOccupancy: number;
  sizeSqMeters?: number;
  basePrice: number;
  currency: string;
  amenities: string[];
  totalRooms: number;
  status: string;
  property?: Property;
  wifiPlanId?: string;
}

interface FormData {
  propertyId: string;
  name: string;
  code: string;
  description: string;
  maxAdults: number;
  maxChildren: number;
  maxOccupancy: number;
  sizeSqMeters: string;
  basePrice: string;
  amenities: string[];
  status: string;
  wifiPlanId?: string;
}

const defaultFormData: FormData = {
  propertyId: '',
  name: '',
  code: '',
  description: '',
  maxAdults: 2,
  maxChildren: 0,
  maxOccupancy: 2,
  sizeSqMeters: '',
  basePrice: '',
  amenities: [],
  status: 'active',
  wifiPlanId: '',
};

export default function RoomTypesManager() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [wifiPlans, setWifiPlans] = useState<WifiPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isAmenityManagerOpen, setIsAmenityManagerOpen] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (result.success) {
          setProperties(result.data);
          if (result.data.length > 0 && !formData.propertyId) {
            setFormData(prev => ({ ...prev, propertyId: result.data[0].id }));
          }
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, []);

  // Fetch amenities
  const fetchAmenities = async () => {
    try {
      const response = await fetch('/api/amenities');
      const result = await response.json();
      if (result.success) {
        setAmenities(result.data);
      }
    } catch (error) {
      console.error('Error fetching amenities:', error);
    }
  };

  useEffect(() => {
    fetchAmenities();
  }, []);

  // Fetch WiFi plans
  useEffect(() => {
    const fetchWifiPlans = async () => {
      try {
        const response = await fetch('/api/wifi/plans?status=active');
        const result = await response.json();
        if (result.success) {
          setWifiPlans(result.data);
        }
      } catch (error) {
        console.error('Error fetching WiFi plans:', error);
      }
    };
    fetchWifiPlans();
  }, []);

  // Fetch room types
  const fetchRoomTypes = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyFilter !== 'all') params.append('propertyId', propertyFilter);
      
      const response = await fetch(`/api/room-types?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setRoomTypes(result.data);
      }
    } catch (error) {
      console.error('Error fetching room types:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch room types',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomTypes();
  }, [propertyFilter]);

  // Generate code from name
  const generateCode = (name: string) => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .substring(0, 6);
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      code: generateCode(name),
    }));
  };

  const toggleAmenity = (amenityId: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenityId)
        ? prev.amenities.filter(a => a !== amenityId)
        : [...prev.amenities, amenityId],
    }));
  };

  // Create room type
  const handleCreate = async () => {
    if (!formData.propertyId || !formData.name || !formData.code || !formData.basePrice) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/room-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          basePrice: parseFloat(formData.basePrice),
          sizeSqMeters: formData.sizeSqMeters ? parseFloat(formData.sizeSqMeters) : null,
          wifiPlanId: formData.wifiPlanId || null,
          currency: 'INR',
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Room type created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchRoomTypes();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create room type',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating room type:', error);
      toast({
        title: 'Error',
        description: 'Failed to create room type',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update room type
  const handleUpdate = async () => {
    if (!selectedRoomType) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/room-types/${selectedRoomType.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          basePrice: parseFloat(formData.basePrice),
          sizeSqMeters: formData.sizeSqMeters ? parseFloat(formData.sizeSqMeters) : null,
          wifiPlanId: formData.wifiPlanId || null,
          currency: 'INR',
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Room type updated successfully',
        });
        setIsEditOpen(false);
        setSelectedRoomType(null);
        fetchRoomTypes();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update room type',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating room type:', error);
      toast({
        title: 'Error',
        description: 'Failed to update room type',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete room type
  const handleDelete = async () => {
    if (!selectedRoomType) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/room-types/${selectedRoomType.id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Room type deleted successfully',
        });
        setIsDeleteOpen(false);
        setSelectedRoomType(null);
        fetchRoomTypes();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete room type',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting room type:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete room type',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsSaving(true);
    try {
      await Promise.all(selectedIds.map(id => fetch(`/api/room-types/${id}`, { method: 'DELETE' })));
      toast({ title: 'Success', description: `${selectedIds.length} room types deleted` });
      setSelectedIds([]);
      fetchRoomTypes();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete some room types', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Export as CSV
  const handleExportCSV = () => {
    const headers = ['name', 'code', 'description', 'maxAdults', 'maxChildren', 'maxOccupancy', 'sizeSqMeters', 'basePrice', 'amenities', 'status'];
    const csvLines = [
      headers.join(','),
      ...roomTypes.map(rt => headers.map(h => {
        if (h === 'amenities') {
          return escapeCSV(rt.amenities?.join(';') || '');
        }
        return escapeCSV(rt[h as keyof RoomType]);
      }).join(','))
    ];
    
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `room-types-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export Complete', description: `Exported ${roomTypes.length} room types to CSV` });
  };

  // Export as JSON
  const handleExportJSON = () => {
    const dataToExport = roomTypes.map(rt => ({
      name: rt.name,
      code: rt.code,
      description: rt.description,
      maxAdults: rt.maxAdults,
      maxChildren: rt.maxChildren,
      maxOccupancy: rt.maxOccupancy,
      sizeSqMeters: rt.sizeSqMeters,
      basePrice: rt.basePrice,
      amenities: rt.amenities,
      status: rt.status,
    }));
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `room-types-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export Complete', description: `Exported ${dataToExport.length} room types to JSON` });
  };

  // Import from file (CSV or JSON)
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isJSON = fileName.endsWith('.json');
    
    if (!isCSV && !isJSON) {
      toast({ title: 'Import Failed', description: 'Please use a CSV or JSON file.', variant: 'destructive' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    try {
      const text = await file.text();
      let data: Record<string, unknown>[] = [];
      
      if (isCSV) {
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');
        
        const headers = parseCSVLine(lines[0]);
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const obj: Record<string, unknown> = {};
          
          headers.forEach((header, index) => {
            const value = values[index] || '';
            
            if (header === 'amenities' && value) {
              obj[header] = value.split(';').filter(a => a.trim());
            } else if (['maxAdults', 'maxChildren', 'maxOccupancy'].includes(header)) {
              obj[header] = parseInt(value) || 0;
            } else if (['sizeSqMeters', 'basePrice'].includes(header)) {
              obj[header] = parseFloat(value) || 0;
            } else {
              obj[header] = value;
            }
          });
          
          data.push(obj);
        }
      } else {
        const jsonData = JSON.parse(text);
        if (!Array.isArray(jsonData)) throw new Error('JSON file must contain an array');
        data = jsonData;
      }
      
      let imported = 0;
      let failed = 0;
      
      for (const item of data) {
        try {
          const response = await fetch('/api/room-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...defaultFormData,
              ...item,
              propertyId: formData.propertyId || properties[0]?.id,
              currency: 'INR',
            }),
          });
          if (response.ok) {
            imported++;
          } else {
            failed++;
          }
        } catch (e) {
          console.error('Failed to import item:', e);
          failed++;
        }
      }
      
      const message = failed > 0 
        ? `Imported ${imported} of ${data.length} room types (${failed} failed)` 
        : `Successfully imported ${imported} room types`;
      
      toast({ 
        title: imported > 0 ? 'Import Complete' : 'Import Failed', 
        description: message,
        variant: imported > 0 ? 'default' : 'destructive'
      });
      fetchRoomTypes();
    } catch (error) {
      console.error('Import error:', error);
      toast({ 
        title: 'Import Failed', 
        description: 'Invalid file format. Please check the file structure.', 
        variant: 'destructive' 
      });
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEditDialog = (roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setFormData({
      propertyId: roomType.propertyId,
      name: roomType.name,
      code: roomType.code,
      description: roomType.description || '',
      maxAdults: roomType.maxAdults,
      maxChildren: roomType.maxChildren,
      maxOccupancy: roomType.maxOccupancy,
      sizeSqMeters: roomType.sizeSqMeters?.toString() || '',
      basePrice: roomType.basePrice.toString(),
      amenities: roomType.amenities || [],
      status: roomType.status,
      wifiPlanId: roomType.wifiPlanId || '',
    });
    setIsEditOpen(true);
  };

  const openViewDialog = (roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setIsViewOpen(true);
  };

  const openDeleteDialog = (roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({
      ...defaultFormData,
      propertyId: properties[0]?.id || '',
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredRoomTypes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRoomTypes.map(rt => rt.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Filter room types by search query
  const filteredRoomTypes = roomTypes.filter(roomType => 
    roomType.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    roomType.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAmenityName = (id: string) => {
    return amenities.find(a => a.id === id || a.name === id)?.name || id;
  };

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return (
      <Badge variant="secondary" className={cn('text-white', option?.color)}>
        {option?.label || status}
      </Badge>
    );
  };

  // Stats
  const stats = {
    total: roomTypes.length,
    totalRooms: roomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0),
    amenities: amenities.length,
    startingPrice: roomTypes.length > 0 ? Math.min(...roomTypes.map(rt => rt.basePrice)) : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Building className="h-5 w-5" />
            Room Types
          </h2>
          <p className="text-sm text-muted-foreground">
            Define room categories, amenities, and pricing
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsAmenityManagerOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Amenities
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import/Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON}>
                <Download className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Import (CSV/JSON)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input ref={fileInputRef} type="file" accept=".csv,.json" onChange={handleImport} className="hidden" />
          <Button size="sm" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Room Type
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="p-4 stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg icon-gradient">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Room Types</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg stat-icon-emerald">
              <BedDouble className="h-4 w-4" />
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
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.amenities}</div>
              <div className="text-xs text-muted-foreground">Amenities</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg stat-icon-amber">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(stats.startingPrice)}</div>
              <div className="text-xs text-muted-foreground">Starting Price</div>
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
                  placeholder="Search room types..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map(property => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button 
                variant={viewMode === 'card' ? 'default' : 'ghost'} 
                size="sm" 
                className="rounded-r-none h-9 px-3" 
                onClick={() => setViewMode('card')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewMode === 'table' ? 'default' : 'ghost'} 
                size="sm" 
                className="rounded-l-none h-9 px-3" 
                onClick={() => setViewMode('table')}
              >
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
      ) : filteredRoomTypes.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Building className="h-12 w-12 mb-4" />
              <p>No room types found</p>
              <p className="text-sm">Create your first room type to get started</p>
              <Button className="mt-4" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Room Type
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'card' ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRoomTypes.map((roomType) => (
            <Card key={roomType.id} className="overflow-hidden hover:shadow-md transition-shadow data-card">
              <div className="h-20 relative bg-gradient-primary">
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-lg">
                      <BedDouble className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-white">
                      <h3 className="font-medium text-sm">{roomType.name}</h3>
                      <p className="text-xs opacity-80">{roomType.code}</p>
                    </div>
                  </div>
                  {getStatusBadge(roomType.status)}
                </div>
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-muted/80">
                    <p className="text-lg font-semibold text-primary">{roomType.totalRooms}</p>
                    <p className="text-xs text-muted-foreground">Rooms</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/80">
                    <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(roomType.basePrice)}</p>
                    <p className="text-xs text-muted-foreground">Base Price</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>{roomType.maxAdults} Adults</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Maximize className="h-3 w-3" />
                    <span>{roomType.sizeSqMeters || '-'} m²</span>
                  </div>
                </div>
                {roomType.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {roomType.amenities.slice(0, 3).map(amenity => (
                      <Badge key={amenity} variant="outline" className="text-xs">
                        {getAmenityName(amenity)}
                      </Badge>
                    ))}
                    {roomType.amenities.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{roomType.amenities.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                {roomType.property && (
                  <p className="text-xs text-muted-foreground">
                    {roomType.property.name}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => openViewDialog(roomType)}>
                    <Eye className="h-3 w-3 mr-1" />View
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => openEditDialog(roomType)}>
                    <Pencil className="h-3 w-3 mr-1" />Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openDeleteDialog(roomType)} className="text-red-600 dark:text-red-400">
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
                        <Checkbox 
                          checked={selectedIds.length === filteredRoomTypes.length && filteredRoomTypes.length > 0} 
                          onCheckedChange={toggleSelectAll} 
                        />
                      </TableHead>
                      <TableHead>Room Type</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Occupancy</TableHead>
                      <TableHead>Rooms</TableHead>
                      <TableHead>Base Price</TableHead>
                      <TableHead>Amenities</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRoomTypes.map((roomType) => (
                      <TableRow key={roomType.id}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedIds.includes(roomType.id)} 
                            onCheckedChange={() => toggleSelect(roomType.id)} 
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded flex items-center justify-center bg-gradient-primary">
                              <BedDouble className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className="font-medium">{roomType.name}</p>
                              <p className="text-xs text-muted-foreground">{roomType.code}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{roomType.property?.name || '-'}</TableCell>
                        <TableCell>
                          <span>{roomType.maxAdults} Adults</span>
                          {roomType.maxChildren > 0 && <span className="text-muted-foreground"> + {roomType.maxChildren} Children</span>}
                        </TableCell>
                        <TableCell>{roomType.totalRooms}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(roomType.basePrice)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {roomType.amenities.slice(0, 2).map(a => (
                              <Badge key={a} variant="outline" className="text-xs">{getAmenityName(a)}</Badge>
                            ))}
                            {roomType.amenities.length > 2 && (
                              <Badge variant="outline" className="text-xs">+{roomType.amenities.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(roomType.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openViewDialog(roomType)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(roomType)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 dark:text-red-400" onClick={() => openDeleteDialog(roomType)}>
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
            {filteredRoomTypes.map((roomType) => (
              <Card key={roomType.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded flex items-center justify-center bg-gradient-primary shrink-0">
                      <BedDouble className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{roomType.name}</p>
                      <p className="text-xs text-muted-foreground">{roomType.code}</p>
                    </div>
                  </div>
                  {getStatusBadge(roomType.status)}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="p-2 rounded-lg bg-muted/80 text-center">
                    <p className="text-lg font-semibold text-primary">{roomType.totalRooms}</p>
                    <p className="text-xs text-muted-foreground">Rooms</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/80 text-center">
                    <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(roomType.basePrice)}</p>
                    <p className="text-xs text-muted-foreground">Base Price</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  <span>{roomType.maxAdults} Adults{roomType.maxChildren > 0 ? ` + ${roomType.maxChildren} Children` : ''}</span>
                  {roomType.property && (
                    <span className="truncate">{roomType.property.name}</span>
                  )}
                </div>
                {roomType.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {roomType.amenities.slice(0, 3).map(a => (
                      <Badge key={a} variant="outline" className="text-xs">{getAmenityName(a)}</Badge>
                    ))}
                    {roomType.amenities.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{roomType.amenities.length - 3}</Badge>
                    )}
                  </div>
                )}
                <div className="flex gap-2 mt-3 pt-2 border-t">
                  <Button variant="outline" size="sm" className="flex-1 h-9 min-h-[44px]" onClick={() => openViewDialog(roomType)}>
                    <Eye className="h-3 w-3 mr-1" />View
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-9 min-h-[44px]" onClick={() => openEditDialog(roomType)}>
                    <Pencil className="h-3 w-3 mr-1" />Edit
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 min-h-[44px] text-red-600 dark:text-red-400" onClick={() => openDeleteDialog(roomType)}>
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
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90dvh] flex flex-col p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Create Room Type</DialogTitle>
            <DialogDescription>Define a new room category</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6" style={{ WebkitOverflowScrolling: 'touch' }}>
            <RoomTypeForm 
              formData={formData}
              setFormData={setFormData}
              properties={properties}
              amenities={amenities}
              wifiPlans={wifiPlans}
              onNameChange={handleNameChange}
              toggleAmenity={toggleAmenity}
            />
          </div>
          <DialogFooter className="shrink-0 px-6 pb-6 pt-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90dvh] flex flex-col p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Edit Room Type</DialogTitle>
            <DialogDescription>Update room type details</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6" style={{ WebkitOverflowScrolling: 'touch' }}>
            <RoomTypeForm 
              formData={formData}
              setFormData={setFormData}
              properties={properties}
              amenities={amenities}
              wifiPlans={wifiPlans}
              onNameChange={handleNameChange}
              toggleAmenity={toggleAmenity}
            />
          </div>
          <DialogFooter className="shrink-0 px-6 pb-6 pt-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90dvh] flex flex-col p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Room Type Details</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6" style={{ WebkitOverflowScrolling: 'touch' }}>
            {selectedRoomType && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                    <BedDouble className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedRoomType.name}</h3>
                    <p className="text-sm text-muted-foreground font-mono">{selectedRoomType.code}</p>
                  </div>
                </div>
                {getStatusBadge(selectedRoomType.status)}
              </div>
              
              {selectedRoomType.description && (
                <p className="text-sm text-muted-foreground">{selectedRoomType.description}</p>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">Max Adults</p>
                  <p className="text-lg font-semibold">{selectedRoomType.maxAdults}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">Max Children</p>
                  <p className="text-lg font-semibold">{selectedRoomType.maxChildren}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">Total Rooms</p>
                  <p className="text-lg font-semibold">{selectedRoomType.totalRooms}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">Size</p>
                  <p className="text-lg font-semibold">{selectedRoomType.sizeSqMeters || '-'} m²</p>
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
                <p className="text-xs text-muted-foreground">Base Price per Night</p>
                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{formatCurrency(selectedRoomType.basePrice)}</p>
              </div>
              
              {selectedRoomType.amenities.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRoomType.amenities.map(amenity => (
                      <Badge key={amenity} variant="secondary">
                        {getAmenityName(amenity)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedRoomType.property && (
                <div className="text-sm text-muted-foreground">
                  Property: {selectedRoomType.property.name}
                </div>
              )}
            </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Room Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedRoomType?.name}&quot;? This action cannot be undone.
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

      {/* Amenity Manager Dialog */}
      <Dialog open={isAmenityManagerOpen} onOpenChange={setIsAmenityManagerOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90dvh] flex flex-col p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Manage Amenities</DialogTitle>
            <DialogDescription>Add, edit, or remove room amenities</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6" style={{ WebkitOverflowScrolling: 'touch' }}>
            <AmenityManager 
              amenities={amenities} 
              onRefresh={fetchAmenities} 
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Room Type Form Component
interface RoomTypeFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  properties: Property[];
  amenities: Amenity[];
  wifiPlans: WifiPlan[];
  onNameChange: (name: string) => void;
  toggleAmenity: (amenityId: string) => void;
}

function RoomTypeForm({ formData, setFormData, properties, amenities, wifiPlans, onNameChange, toggleAmenity }: RoomTypeFormProps) {
  return (
    <div className="space-y-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Property</Label>
          <Select value={formData.propertyId} onValueChange={(value) => setFormData(prev => ({ ...prev, propertyId: value }))}>
            <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
            <SelectContent>
              {properties.map(property => (
                <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
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
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input value={formData.name} onChange={(e) => onNameChange(e.target.value)} placeholder="Deluxe Room" />
        </div>
        <div className="space-y-2">
          <Label>Code</Label>
          <Input value={formData.code} readOnly className="bg-muted font-mono" />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Room description..."
          rows={2}
        />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Max Adults</Label>
          <Input type="number" min="1" value={formData.maxAdults} onChange={(e) => setFormData(prev => ({ ...prev, maxAdults: parseInt(e.target.value) || 1 }))} />
        </div>
        <div className="space-y-2">
          <Label>Max Children</Label>
          <Input type="number" min="0" value={formData.maxChildren} onChange={(e) => setFormData(prev => ({ ...prev, maxChildren: parseInt(e.target.value) || 0 }))} />
        </div>
        <div className="space-y-2">
          <Label>Size (m²)</Label>
          <Input type="number" min="0" value={formData.sizeSqMeters} onChange={(e) => setFormData(prev => ({ ...prev, sizeSqMeters: e.target.value }))} placeholder="30" />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Base Price per Night *</Label>
        <Input type="number" min="0" step="0.01" value={formData.basePrice} onChange={(e) => setFormData(prev => ({ ...prev, basePrice: e.target.value }))} placeholder="0.00" />
      </div>
      
      <div className="space-y-2">
        <Label>WiFi Plan</Label>
        <Select 
          value={formData.wifiPlanId || ''} 
          onValueChange={(value) => setFormData(prev => ({ ...prev, wifiPlanId: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Default (from AAA Settings)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Default (from AAA Settings)</SelectItem>
            {wifiPlans.map(plan => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}{plan.speed ? ` - ${plan.speed}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">WiFi plan automatically assigned when a guest checks into this room type</p>
      </div>
      
      <div className="space-y-2">
        <Label>Amenities</Label>
        <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-48 overflow-y-auto">
          {amenities.filter(a => a.isActive).map(amenity => (
            <Badge
              key={amenity.id}
              variant={formData.amenities.includes(amenity.id) ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-colors',
                formData.amenities.includes(amenity.id) && 'bg-teal-600 hover:bg-teal-700'
              )}
              onClick={() => toggleAmenity(amenity.id)}
            >
              {amenity.name}
            </Badge>
          ))}
          {amenities.filter(a => a.isActive).length === 0 && (
            <p className="text-sm text-muted-foreground">No amenities available</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Amenity Manager Component
interface AmenityManagerProps {
  amenities: Amenity[];
  onRefresh: () => void;
}

function AmenityManager({ amenities, onRefresh }: AmenityManagerProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [newAmenity, setNewAmenity] = useState({ name: '', category: 'general' });
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!newAmenity.name.trim()) return;
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/amenities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAmenity),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({ title: 'Success', description: 'Amenity created' });
        setNewAmenity({ name: '', category: 'general' });
        setIsCreating(false);
        onRefresh();
      } else {
        toast({ title: 'Error', description: 'Failed to create amenity', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create amenity', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (amenity: Amenity) => {
    try {
      const response = await fetch(`/api/amenities/${amenity.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !amenity.isActive }),
      });
      
      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error toggling amenity:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {AMENITY_CATEGORIES.map(cat => (
            <Badge key={cat.value} variant="outline">{cat.label}</Badge>
          ))}
        </div>
        <Button size="sm" onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-1" />Add
        </Button>
      </div>
      
      {isCreating && (
        <div className="flex gap-2 p-3 border rounded-lg bg-muted">
          <Input
            value={newAmenity.name}
            onChange={(e) => setNewAmenity(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Amenity name"
            className="flex-1"
          />
          <Select value={newAmenity.category} onValueChange={(value) => setNewAmenity(prev => ({ ...prev, category: value }))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AMENITY_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleCreate} disabled={isSaving}>Save</Button>
          <Button size="sm" variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
        </div>
      )}
      
      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {amenities.map(amenity => (
            <div key={amenity.id} className="flex items-center justify-between p-2 border rounded-lg">
              <div className="flex items-center gap-2">
                <Switch checked={amenity.isActive} onCheckedChange={() => handleToggle(amenity)} />
                <span className={cn(!amenity.isActive && 'text-muted-foreground')}>{amenity.name}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {AMENITY_CATEGORIES.find(c => c.value === amenity.category)?.label || amenity.category}
              </Badge>
            </div>
          ))}
          {amenities.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No amenities defined</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
