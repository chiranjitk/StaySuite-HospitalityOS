'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Progress } from '@/components/ui/progress';
import { 
  Building2, 
  Plus, 
  Pencil, 
  Trash2, 
  Search,
  Grid,
  List,
  Loader2,
  DoorOpen,
  Eye,
  Mountain,
  Waves,
  Accessibility,
  Cigarette,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { RoomImageGallery } from './room-image-gallery';

interface Property {
  id: string;
  name: string;
  totalFloors: number;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  basePrice: number;
}

interface Room {
  id: string;
  propertyId: string;
  roomTypeId: string;
  number: string;
  name?: string;
  floor: number;
  isAccessible: boolean;
  isSmoking: boolean;
  hasBalcony: boolean;
  hasSeaView: boolean;
  hasMountainView: boolean;
  status: string;
  digitalKeyEnabled: boolean;
  images?: string;
  roomType: RoomType;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

const roomStatuses = [
  { value: 'available', label: 'Available', color: 'bg-emerald-500', textColor: 'text-emerald-500' },
  { value: 'occupied', label: 'Occupied', color: 'bg-blue-500', textColor: 'text-blue-500' },
  { value: 'dirty', label: 'Dirty', color: 'bg-yellow-500', textColor: 'text-yellow-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-500', textColor: 'text-orange-500' },
  { value: 'out_of_order', label: 'Out of Order', color: 'bg-red-500', textColor: 'text-red-500' },
];

export default function RoomsManager() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Bulk import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importPropertyId, setImportPropertyId] = useState<string>('');
  
  // Form state
  const [formData, setFormData] = useState({
    propertyId: '',
    roomTypeId: '',
    number: '',
    name: '',
    floor: 1,
    isAccessible: false,
    isSmoking: false,
    hasBalcony: false,
    hasSeaView: false,
    hasMountainView: false,
    status: 'available',
    digitalKeyEnabled: false,
    images: [] as string[],
  });

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
            setImportPropertyId(result.data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, []);

  // Fetch room types when property changes
  useEffect(() => {
    const fetchRoomTypes = async () => {
      if (!formData.propertyId) return;
      try {
        const response = await fetch(`/api/room-types?propertyId=${formData.propertyId}`);
        const result = await response.json();
        if (result.success) {
          setRoomTypes(result.data);
          if (result.data.length > 0 && !formData.roomTypeId) {
            setFormData(prev => ({ ...prev, roomTypeId: result.data[0].id }));
          }
        }
      } catch (error) {
        console.error('Error fetching room types:', error);
      }
    };
    fetchRoomTypes();
  }, [formData.propertyId]);

  // Fetch rooms
  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyFilter !== 'all') params.append('propertyId', propertyFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/rooms?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setRooms(result.data);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch rooms',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [propertyFilter, statusFilter]);

  // Create room
  const handleCreate = async () => {
    if (!formData.propertyId || !formData.roomTypeId || !formData.number) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Room created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchRooms();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create room',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: 'Error',
        description: 'Failed to create room',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update room
  const handleUpdate = async () => {
    if (!selectedRoom) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/rooms/${selectedRoom.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          images: JSON.stringify(formData.images),
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Room updated successfully',
        });
        setIsEditOpen(false);
        setSelectedRoom(null);
        fetchRooms();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update room',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating room:', error);
      toast({
        title: 'Error',
        description: 'Failed to update room',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete room
  const handleDelete = async () => {
    if (!selectedRoom) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/rooms/${selectedRoom.id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Room deleted successfully',
        });
        setIsDeleteOpen(false);
        setSelectedRoom(null);
        fetchRooms();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete room',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete room',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Quick status update
  const updateRoomStatus = async (roomId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Room status updated',
        });
        fetchRooms();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update room status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating room status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update room status',
        variant: 'destructive',
      });
    }
  };

  // CSV Download Template
  const downloadTemplate = () => {
    const headers = ['number', 'roomTypeCode', 'floor', 'name', 'isAccessible', 'isSmoking', 'hasBalcony', 'hasSeaView', 'hasMountainView', 'status'];
    const sampleData = [
      ['101', 'STD', '1', 'Standard Room 101', 'false', 'false', 'false', 'false', 'false', 'available'],
      ['102', 'STD', '1', 'Standard Room 102', 'false', 'false', 'false', 'false', 'false', 'available'],
      ['201', 'DLX', '2', 'Deluxe Room 201', 'false', 'false', 'true', 'true', 'false', 'available'],
    ];
    
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rooms_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Parse CSV
  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  // Bulk Import Handler
  const handleBulkImport = async () => {
    if (!importFile || !importPropertyId) {
      toast({
        title: 'Error',
        description: 'Please select a file and property',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setImportResult(null);

    try {
      const text = await importFile.text();
      const rows = parseCSV(text);
      
      if (rows.length < 2) {
        throw new Error('CSV file must have a header row and at least one data row');
      }

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const dataRows = rows.slice(1);

      const result: ImportResult = {
        total: dataRows.length,
        success: 0,
        failed: 0,
        errors: []
      };

      // Get room types for mapping
      const roomTypesResponse = await fetch(`/api/room-types?propertyId=${importPropertyId}`);
      const roomTypesResult = await roomTypesResponse.json();
      const roomTypesMap = new Map(
        (roomTypesResult.data || []).map((rt: RoomType) => [rt.code.toLowerCase(), rt.id])
      );

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row.some(cell => cell)) continue; // Skip empty rows

        try {
          const getValue = (name: string) => {
            const idx = headers.indexOf(name.toLowerCase());
            return idx >= 0 ? row[idx]?.trim() : '';
          };

          const roomTypeCode = getValue('roomTypeCode');
          const roomTypeId = roomTypesMap.get(roomTypeCode?.toLowerCase() || '');
          
          if (!roomTypeId) {
            result.failed++;
            result.errors.push(`Row ${i + 2}: Invalid room type code "${roomTypeCode}"`);
            continue;
          }

          const roomData = {
            propertyId: importPropertyId,
            roomTypeId,
            number: getValue('number'),
            name: getValue('name'),
            floor: parseInt(getValue('floor')) || 1,
            isAccessible: getValue('isAccessible').toLowerCase() === 'true',
            isSmoking: getValue('isSmoking').toLowerCase() === 'true',
            hasBalcony: getValue('hasBalcony').toLowerCase() === 'true',
            hasSeaView: getValue('hasSeaView').toLowerCase() === 'true',
            hasMountainView: getValue('hasMountainView').toLowerCase() === 'true',
            status: getValue('status') || 'available',
          };

          if (!roomData.number) {
            result.failed++;
            result.errors.push(`Row ${i + 2}: Room number is required`);
            continue;
          }

          const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roomData),
          });

          const responseResult = await response.json();
          
          if (responseResult.success) {
            result.success++;
          } else {
            result.failed++;
            result.errors.push(`Row ${i + 2}: ${responseResult.error?.message || 'Failed to create room'}`);
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`Row ${i + 2}: Unexpected error`);
        }

        setImportProgress(Math.round(((i + 1) / dataRows.length) * 100));
      }

      setImportResult(result);
      fetchRooms();
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import rooms',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const openEditDialog = (room: Room) => {
    setSelectedRoom(room);
    // Parse images from JSON string
    let roomImages: string[] = [];
    try {
      roomImages = room.images ? JSON.parse(room.images) : [];
    } catch {
      roomImages = [];
    }
    
    setFormData({
      propertyId: room.propertyId,
      roomTypeId: room.roomTypeId,
      number: room.number,
      name: room.name || '',
      floor: room.floor,
      isAccessible: room.isAccessible,
      isSmoking: room.isSmoking,
      hasBalcony: room.hasBalcony,
      hasSeaView: room.hasSeaView,
      hasMountainView: room.hasMountainView,
      status: room.status,
      digitalKeyEnabled: room.digitalKeyEnabled,
      images: roomImages,
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (room: Room) => {
    setSelectedRoom(room);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({
      propertyId: properties[0]?.id || '',
      roomTypeId: roomTypes[0]?.id || '',
      number: '',
      name: '',
      floor: 1,
      isAccessible: false,
      isSmoking: false,
      hasBalcony: false,
      hasSeaView: false,
      hasMountainView: false,
      status: 'available',
      digitalKeyEnabled: false,
      images: [],
    });
  };

  // Filter rooms by search query
  const filteredRooms = rooms.filter(room => 
    room.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.roomType.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group rooms by floor
  const roomsByFloor = filteredRooms.reduce((acc, room) => {
    const floor = room.floor;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);

  const getStatusInfo = (status: string) => {
    return roomStatuses.find(s => s.value === status) || roomStatuses[0];
  };

  // Stats
  const stats = {
    total: rooms.length,
    available: rooms.filter(r => r.status === 'available').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    dirty: rooms.filter(r => r.status === 'dirty').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
    outOfOrder: rooms.filter(r => r.status === 'out_of_order').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Rooms
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage rooms and their status
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Room
          </Button>
        </div>
      </div>

      {/* Status Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Rooms</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-emerald-500">{stats.available}</div>
          <div className="text-xs text-muted-foreground">Available</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-500">{stats.occupied}</div>
          <div className="text-xs text-muted-foreground">Occupied</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-yellow-500">{stats.dirty}</div>
          <div className="text-xs text-muted-foreground">Dirty</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-orange-500">{stats.maintenance}</div>
          <div className="text-xs text-muted-foreground">Maintenance</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-red-500">{stats.outOfOrder}</div>
          <div className="text-xs text-muted-foreground">Out of Order</div>
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
                  placeholder="Search rooms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select Property" />
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {roomStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1 border rounded-md p-1">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rooms Grid/List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredRooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <DoorOpen className="h-12 w-12 mb-4" />
            <p>No rooms found</p>
            <p className="text-sm">Create your first room or use bulk import to add multiple rooms</p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        // Grid View
        <div className="space-y-6">
          {Object.entries(roomsByFloor)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([floor, floorRooms]) => (
              <Card key={floor}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Floor {floor}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                    {floorRooms.map((room) => {
                      const statusInfo = getStatusInfo(room.status);
                      return (
                        <div
                          key={room.id}
                          className={cn(
                            "relative rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md",
                            "hover:border-primary/50"
                          )}
                          onClick={() => openEditDialog(room)}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className={cn("w-3 h-3 rounded-full", statusInfo.color)} />
                            <span className="font-bold text-lg">{room.number}</span>
                            <span className="text-xs text-muted-foreground text-center truncate w-full">
                              {room.roomType.code}
                            </span>
                          </div>
                          {/* Feature indicators */}
                          <div className="absolute top-1 right-1 flex gap-0.5">
                            {room.hasSeaView && (
                              <Waves className="h-3 w-3 text-blue-400" />
                            )}
                            {room.hasMountainView && (
                              <Mountain className="h-3 w-3 text-green-400" />
                            )}
                            {room.isAccessible && (
                              <Accessibility className="h-3 w-3 text-purple-400" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      ) : (
        <>
        {/* Mobile Card List View */}
        <div className="md:hidden space-y-3">
          {filteredRooms.map((room) => {
            const statusInfo = getStatusInfo(room.status);
            return (
              <Card key={room.id} className="p-3 space-y-2" onClick={() => openEditDialog(room)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("w-3 h-3 rounded-full shrink-0", statusInfo.color)} />
                    <span className="font-bold text-lg">{room.number}</span>
                    {room.name && <span className="text-sm text-muted-foreground truncate">({room.name})</span>}
                  </div>
                  <Badge variant="outline">{room.roomType.code}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {room.hasSeaView && <Badge variant="secondary" className="text-xs"><Waves className="h-3 w-3 mr-1" />Sea</Badge>}
                  {room.hasMountainView && <Badge variant="secondary" className="text-xs"><Mountain className="h-3 w-3 mr-1" />Mtn</Badge>}
                  {room.hasBalcony && <Badge variant="secondary" className="text-xs">Balcony</Badge>}
                  {room.isAccessible && <Badge variant="secondary" className="text-xs"><Accessibility className="h-3 w-3 mr-1" />A11y</Badge>}
                  {room.isSmoking && <Badge variant="secondary" className="text-xs"><Cigarette className="h-3 w-3 mr-1" />Smoking</Badge>}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs text-muted-foreground">Floor {room.floor}</div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-11 min-w-[44px]" onClick={(e) => { e.stopPropagation(); openEditDialog(room); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-11 min-w-[44px] text-destructive" onClick={(e) => { e.stopPropagation(); openDeleteDialog(room); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        {/* Desktop Table List View */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium">Room</th>
                  <th className="text-left p-4 font-medium">Type</th>
                  <th className="text-left p-4 font-medium">Floor</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Features</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((room) => {
                  const statusInfo = getStatusInfo(room.status);
                  return (
                    <tr key={room.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <div>
                          <span className="font-bold">{room.number}</span>
                          {room.name && (
                            <span className="text-muted-foreground ml-2">({room.name})</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">{room.roomType.name}</Badge>
                      </td>
                      <td className="p-4">{room.floor}</td>
                      <td className="p-4">
                        <Select
                          value={room.status}
                          onValueChange={(value) => updateRoomStatus(room.id, value)}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", statusInfo.color)} />
                              <span>{statusInfo.label}</span>
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {roomStatuses.map(status => (
                              <SelectItem key={status.value} value={status.value}>
                                <div className="flex items-center gap-2">
                                  <div className={cn("w-2 h-2 rounded-full", status.color)} />
                                  {status.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          {room.hasSeaView && (
                            <Badge variant="secondary" className="text-xs">
                              <Waves className="h-3 w-3 mr-1" /> Sea
                            </Badge>
                          )}
                          {room.hasMountainView && (
                            <Badge variant="secondary" className="text-xs">
                              <Mountain className="h-3 w-3 mr-1" /> Mountain
                            </Badge>
                          )}
                          {room.hasBalcony && (
                            <Badge variant="secondary" className="text-xs">Balcony</Badge>
                          )}
                          {room.isAccessible && (
                            <Badge variant="secondary" className="text-xs">
                              <Accessibility className="h-3 w-3 mr-1" /> Accessible
                            </Badge>
                          )}
                          {room.isSmoking && (
                            <Badge variant="secondary" className="text-xs">
                              <Cigarette className="h-3 w-3 mr-1" /> Smoking
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(room)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(room)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90dvh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Add New Room</DialogTitle>
            <DialogDescription>
              Create a new room
            </DialogDescription>
          </DialogHeader>
          <RoomForm 
            formData={formData}
            setFormData={setFormData}
            properties={properties}
            roomTypes={roomTypes}
          />
          <DialogFooter>
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
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90dvh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Edit Room</DialogTitle>
            <DialogDescription>
              Update room details
            </DialogDescription>
          </DialogHeader>
          <RoomForm 
            formData={formData}
            setFormData={setFormData}
            properties={properties}
            roomTypes={roomTypes}
          />
          {/* Room Images Section */}
          <div className="space-y-2 pt-4 border-t">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Room Photos
            </Label>
            <div className="flex items-center gap-2">
              <RoomImageGallery
                roomId={selectedRoom?.id || ''}
                images={formData.images}
                onImagesChange={(images) => setFormData(prev => ({ ...prev, images }))}
              />
              {formData.images.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {formData.images.length} photo{formData.images.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <DialogFooter>
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

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90dvh]">
          <DialogHeader>
            <DialogTitle>Delete Room</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete room &quot;{selectedRoom?.number}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90dvh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Bulk Import Rooms</DialogTitle>
            <DialogDescription>
              Import multiple rooms from a CSV file
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Property Selection */}
            <div className="space-y-2">
              <Label>Select Property *</Label>
              <Select value={importPropertyId} onValueChange={setImportPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(property => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>CSV File</Label>
              <div 
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] || null);
                    setImportResult(null);
                  }}
                />
                {importFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileSpreadsheet className="h-5 w-5 text-green-500" />
                    <span>{importFile.name}</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <Upload className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Click to upload CSV file</p>
                  </div>
                )}
              </div>
            </div>

            {/* Template Download */}
            <Button variant="outline" className="w-full" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>

            {/* Progress */}
            {importing && (
              <div className="space-y-2">
                <Progress value={importProgress} />
                <p className="text-sm text-muted-foreground text-center">
                  Importing... {importProgress}%
                </p>
              </div>
            )}

            {/* Results */}
            {importResult && (
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {importResult.success} succeeded
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-red-500" />
                    {importResult.failed} failed
                  </span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {importResult.errors.slice(0, 10).map((error, i) => (
                      <p key={i} className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {error}
                      </p>
                    ))}
                    {importResult.errors.length > 10 && (
                      <p className="text-xs text-muted-foreground">
                        ...and {importResult.errors.length - 10} more errors
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => {
              setIsBulkImportOpen(false);
              setImportFile(null);
              setImportResult(null);
              setImportProgress(0);
            }}>
              Close
            </Button>
            <Button onClick={handleBulkImport} disabled={importing || !importFile || !importPropertyId}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import Rooms
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Room Form Component
interface RoomFormData {
  propertyId: string;
  roomTypeId: string;
  number: string;
  name: string;
  floor: number;
  isAccessible: boolean;
  isSmoking: boolean;
  hasBalcony: boolean;
  hasSeaView: boolean;
  hasMountainView: boolean;
  status: string;
  digitalKeyEnabled: boolean;
  images: string[];
}

interface RoomFormProps {
  formData: RoomFormData;
  setFormData: React.Dispatch<React.SetStateAction<RoomFormData>>;
  properties: Property[];
  roomTypes: RoomType[];
}

function RoomForm({ formData, setFormData, properties, roomTypes }: RoomFormProps) {
  const { formatCurrency } = useCurrency();
  const selectedProperty = properties.find(p => p.id === formData.propertyId);
  
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="propertyId">Property *</Label>
          <Select 
            value={formData.propertyId as string} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, propertyId: value, roomTypeId: '' }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map(property => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="roomTypeId">Room Type *</Label>
          <Select 
            value={formData.roomTypeId as string} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, roomTypeId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {roomTypes.map(type => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name} ({formatCurrency(type.basePrice)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="number">Room Number *</Label>
          <Input
            id="number"
            value={formData.number as string}
            onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
            placeholder="101"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name (Optional)</Label>
          <Input
            id="name"
            value={formData.name as string}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Honeymoon Suite"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="floor">Floor</Label>
          <Input
            id="floor"
            type="number"
            min="1"
            max={selectedProperty?.totalFloors || 50}
            value={formData.floor as number}
            onChange={(e) => setFormData(prev => ({ ...prev, floor: parseInt(e.target.value) || 1 }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select 
            value={formData.status as string} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roomStatuses.map(status => (
                <SelectItem key={status.value} value={status.value}>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", status.color)} />
                    {status.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-3">
        <Label>Features</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer min-h-[44px]">
            <Switch
              checked={formData.isAccessible as boolean}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isAccessible: checked }))}
            />
            <Accessibility className="h-4 w-4" />
            <span>Accessible</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch
              checked={formData.isSmoking as boolean}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isSmoking: checked }))}
            />
            <Cigarette className="h-4 w-4" />
            <span>Smoking</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch
              checked={formData.hasBalcony as boolean}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasBalcony: checked }))}
            />
            <DoorOpen className="h-4 w-4" />
            <span>Balcony</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch
              checked={formData.hasSeaView as boolean}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasSeaView: checked }))}
            />
            <Waves className="h-4 w-4" />
            <span>Sea View</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch
              checked={formData.hasMountainView as boolean}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasMountainView: checked }))}
            />
            <Mountain className="h-4 w-4" />
            <span>Mountain View</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch
              checked={formData.digitalKeyEnabled as boolean}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, digitalKeyEnabled: checked }))}
            />
            <Eye className="h-4 w-4" />
            <span>Digital Key</span>
          </label>
        </div>
      </div>
    </div>
  );
}
