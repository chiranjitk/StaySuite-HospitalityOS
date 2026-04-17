'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Building2, 
  Plus, 
  Pencil, 
  Trash2, 
  Search,
  Loader2,
  Map,
  ZoomIn,
  ZoomOut,
  Move,
  Grid3X3,
  Save,
  ArrowLeft,
  Eye,
  Maximize2,
  Layers,
  DoorOpen,
  User,
  Clock,
  Undo2,
  Redo2,
  Wand2,
  Download,
  RotateCcw,
  Copy,
  Grid2X2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
  status: string;
  roomType: RoomType;
}

interface RoomPosition {
  roomId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

interface FloorPlanRoom {
  id: string;
  floorPlanId: string;
  roomId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  room: Room;
}

interface FloorPlan {
  id: string;
  propertyId: string;
  floor: number;
  name: string;
  imageUrl?: string;
  svgData?: string;
  roomPositions: string;
  width?: number;
  height?: number;
  gridSize: number;
  property: Property;
  floorPlanRooms?: FloorPlanRoom[];
  placedRooms?: FloorPlanRoom[];
  unplacedRooms?: Room[];
}

const roomStatuses = [
  { value: 'available', label: 'Available', color: 'bg-emerald-500', borderColor: 'border-emerald-500' },
  { value: 'occupied', label: 'Occupied', color: 'bg-blue-500', borderColor: 'border-blue-500' },
  { value: 'dirty', label: 'Dirty', color: 'bg-yellow-500', borderColor: 'border-yellow-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-500', borderColor: 'border-orange-500' },
  { value: 'out_of_order', label: 'Out of Order', color: 'bg-red-500', borderColor: 'border-red-500' },
];

const defaultRoomSize = { width: 80, height: 60 };

// History state for undo/redo
interface HistoryState {
  roomPositions: RoomPosition[];
}

export default function FloorPlans() {
  const { toast } = useToast();
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  
  // View states
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'viewer'>('list');
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<FloorPlan | null>(null);
  
  // Editor states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [roomPositions, setRoomPositions] = useState<RoomPosition[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [draggingRoom, setDraggingRoom] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Resizing states
  const [resizingRoom, setResizingRoom] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  
  // History for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isRoomMapOpen, setIsRoomMapOpen] = useState(false);
  const [isSavingDialog, setIsSavingDialog] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    propertyId: '',
    floor: 1,
    name: '',
    width: 800,
    height: 600,
    gridSize: 20,
  });
  
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);

  // History management
  const pushToHistory = useCallback((positions: RoomPosition[]) => {
    const newState: HistoryState = { roomPositions: JSON.parse(JSON.stringify(positions)) };
    const newHistory = [...history.slice(0, historyIndex + 1), newState];
    // Keep only last 50 states
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setRoomPositions(JSON.parse(JSON.stringify(history[newIndex].roomPositions)));
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setRoomPositions(JSON.parse(JSON.stringify(history[newIndex].roomPositions)));
    }
  }, [history, historyIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode === 'editor') {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
          e.preventDefault();
          redo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          saveRoomPositions();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, undo, redo]);

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

  // Fetch floor plans
  const fetchFloorPlans = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyFilter !== 'all') params.append('propertyId', propertyFilter);
      
      const response = await fetch(`/api/floor-plans?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setFloorPlans(result.data);
      }
    } catch (error) {
      console.error('Error fetching floor plans:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch floor plans',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFloorPlans();
  }, [propertyFilter]);

  // Fetch rooms when property changes in editor
  const fetchRooms = async (propertyId: string, floor: number) => {
    try {
      const response = await fetch(`/api/rooms?propertyId=${propertyId}&floor=${floor}`);
      const result = await response.json();
      if (result.success) {
        setRooms(result.data);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  // Create floor plan
  const handleCreate = async () => {
    if (!formData.propertyId || !formData.name) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSavingDialog(true);
    try {
      const response = await fetch('/api/floor-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Floor plan created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchFloorPlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create floor plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating floor plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to create floor plan',
        variant: 'destructive',
      });
    } finally {
      setIsSavingDialog(false);
    }
  };

  // Update floor plan
  const handleUpdate = async () => {
    if (!selectedFloorPlan) return;
    setIsSavingDialog(true);
    try {
      const response = await fetch('/api/floor-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedFloorPlan.id,
          ...formData,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Floor plan updated successfully',
        });
        setIsEditOpen(false);
        fetchFloorPlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update floor plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating floor plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to update floor plan',
        variant: 'destructive',
      });
    } finally {
      setIsSavingDialog(false);
    }
  };

  // Delete floor plan
  const handleDelete = async () => {
    if (!selectedFloorPlan) return;
    setIsSavingDialog(true);
    try {
      const response = await fetch(`/api/floor-plans?id=${selectedFloorPlan.id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Floor plan deleted successfully',
        });
        setIsDeleteOpen(false);
        setSelectedFloorPlan(null);
        fetchFloorPlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete floor plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting floor plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete floor plan',
        variant: 'destructive',
      });
    } finally {
      setIsSavingDialog(false);
    }
  };

  // Save room positions
  const saveRoomPositions = async () => {
    if (!selectedFloorPlan) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/floor-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedFloorPlan.id,
          roomPositions,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Room positions saved successfully',
        });
        setSelectedFloorPlan(result.data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to save room positions',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving room positions:', error);
      toast({
        title: 'Error',
        description: 'Failed to save room positions',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-arrange rooms
  const autoArrangeRooms = useCallback(() => {
    const gridSize = selectedFloorPlan?.gridSize || 20;
    const canvasWidth = selectedFloorPlan?.width || 800;
    const canvasHeight = selectedFloorPlan?.height || 600;
    const padding = 20;
    const spacing = 10;
    
    // Calculate available space
    const availableWidth = canvasWidth - (padding * 2);
    const cols = Math.floor(availableWidth / (defaultRoomSize.width + spacing));
    
    const newPositions: RoomPosition[] = rooms.map((room, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      return {
        roomId: room.id,
        x: padding + col * (defaultRoomSize.width + spacing),
        y: padding + row * (defaultRoomSize.height + spacing),
        width: defaultRoomSize.width,
        height: defaultRoomSize.height,
        rotation: 0,
      };
    });
    
    setRoomPositions(newPositions);
    pushToHistory(newPositions);
    
    toast({
      title: 'Auto-arranged',
      description: `Arranged ${rooms.length} rooms in a grid layout`,
    });
  }, [rooms, selectedFloorPlan, pushToHistory]);

  // Export as image
  const exportAsImage = useCallback(async () => {
    if (!canvasRef.current || !selectedFloorPlan) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = selectedFloorPlan.width || 800;
    const height = selectedFloorPlan.height || 600;
    
    canvas.width = width * 2; // 2x for better quality
    canvas.height = height * 2;
    ctx.scale(2, 2);
    
    // Draw background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    const gridSize = selectedFloorPlan.gridSize || 20;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Draw rooms
    roomPositions.forEach(position => {
      const room = rooms.find(r => r.id === position.roomId);
      if (!room) return;
      
      const statusInfo = roomStatuses.find(s => s.value === room.status) || roomStatuses[0];
      
      // Draw room rectangle
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = statusInfo.color.replace('bg-', '').includes('emerald') ? '#10b981' :
                        statusInfo.color.replace('bg-', '').includes('blue') ? '#3b82f6' :
                        statusInfo.color.replace('bg-', '').includes('yellow') ? '#eab308' :
                        statusInfo.color.replace('bg-', '').includes('orange') ? '#f97316' : '#ef4444';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.roundRect(position.x, position.y, position.width, position.height, 8);
      ctx.fill();
      ctx.stroke();
      
      // Draw status indicator
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(position.x + position.width / 2, position.y + 12, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw room number
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(room.number, position.x + position.width / 2, position.y + position.height / 2 + 4);
      
      // Draw room type
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText(room.roomType.code, position.x + position.width / 2, position.y + position.height / 2 + 16);
    });
    
    // Download
    const link = document.createElement('a');
    link.download = `${selectedFloorPlan.name.replace(/\s+/g, '_')}_floorplan.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    toast({
      title: 'Exported',
      description: 'Floor plan exported as PNG image',
    });
  }, [roomPositions, rooms, selectedFloorPlan, toast]);

  // Open editor
  const openEditor = async (floorPlan: FloorPlan) => {
    setSelectedFloorPlan(floorPlan);
    const positions = JSON.parse(floorPlan.roomPositions || '[]');
    setRoomPositions(positions);
    
    // Initialize history
    setHistory([{ roomPositions: JSON.parse(JSON.stringify(positions)) }]);
    setHistoryIndex(0);
    
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedRoom(null);
    await fetchRooms(floorPlan.propertyId, floorPlan.floor);
    setViewMode('editor');
  };

  // Open viewer
  const openViewer = async (floorPlan: FloorPlan) => {
    setSelectedFloorPlan(floorPlan);
    setRoomPositions(JSON.parse(floorPlan.roomPositions || '[]'));
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedRoom(null);
    await fetchRooms(floorPlan.propertyId, floorPlan.floor);
    setViewMode('viewer');
  };

  // Open edit dialog
  const openEditDialog = (floorPlan: FloorPlan) => {
    setSelectedFloorPlan(floorPlan);
    setFormData({
      propertyId: floorPlan.propertyId,
      floor: floorPlan.floor,
      name: floorPlan.name,
      width: floorPlan.width || 800,
      height: floorPlan.height || 600,
      gridSize: floorPlan.gridSize || 20,
    });
    setIsEditOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (floorPlan: FloorPlan) => {
    setSelectedFloorPlan(floorPlan);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({
      propertyId: properties[0]?.id || '',
      floor: 1,
      name: '',
      width: 800,
      height: 600,
      gridSize: 20,
    });
  };

  // Get status info
  const getStatusInfo = (status: string) => {
    return roomStatuses.find(s => s.value === status) || roomStatuses[0];
  };

  // Get room by ID
  const getRoomById = (roomId: string) => {
    return rooms.find(r => r.id === roomId);
  };

  // Get room position
  const getRoomPosition = (roomId: string) => {
    return roomPositions.find(p => p.roomId === roomId);
  };

  // Handle canvas pan
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedRoom(null);
    }
  }, [pan]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && !draggingRoom && !resizingRoom) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart, draggingRoom, resizingRoom]);

  const handleCanvasMouseUp = useCallback(() => {
    if (draggingRoom || resizingRoom) {
      pushToHistory(roomPositions);
    }
    setIsDragging(false);
    setDraggingRoom(null);
    setResizingRoom(null);
    setResizeHandle(null);
  }, [draggingRoom, resizingRoom, roomPositions, pushToHistory]);

  // Handle room drag
  const handleRoomMouseDown = useCallback((e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    const position = getRoomPosition(roomId);
    if (!position) return;

    const rect = editorRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDraggingRoom(roomId);
    setSelectedRoom(roomId);
    setDragOffset({
      x: (e.clientX - rect.left - pan.x) / zoom - position.x,
      y: (e.clientY - rect.top - pan.y) / zoom - position.y,
    });
  }, [pan, zoom, roomPositions]);

  const handleRoomMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingRoom) {
      const rect = editorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const gridSize = selectedFloorPlan?.gridSize || 20;
      let newX = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      let newY = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;

      // Snap to grid
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;

      // Clamp to canvas bounds
      const position = getRoomPosition(draggingRoom);
      if (position) {
        const maxX = (selectedFloorPlan?.width || 800) - position.width;
        const maxY = (selectedFloorPlan?.height || 600) - position.height;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
      }

      setRoomPositions(prev => 
        prev.map(p => p.roomId === draggingRoom ? { ...p, x: newX, y: newY } : p)
      );
    }
    
    if (resizingRoom && resizeHandle) {
      const rect = editorRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const currentX = (e.clientX - rect.left - pan.x) / zoom;
      const currentY = (e.clientY - rect.top - pan.y) / zoom;
      const gridSize = selectedFloorPlan?.gridSize || 20;
      
      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;
      let newX = resizeStart.posX;
      let newY = resizeStart.posY;
      
      if (resizeHandle.includes('e')) {
        newWidth = Math.max(40, Math.round((currentX - resizeStart.posX) / gridSize) * gridSize);
      }
      if (resizeHandle.includes('w')) {
        const deltaX = currentX - resizeStart.x;
        newX = Math.round((resizeStart.posX + deltaX) / gridSize) * gridSize;
        newWidth = resizeStart.width - (newX - resizeStart.posX);
        if (newWidth < 40) {
          newWidth = 40;
          newX = resizeStart.posX + resizeStart.width - 40;
        }
      }
      if (resizeHandle.includes('s')) {
        newHeight = Math.max(30, Math.round((currentY - resizeStart.posY) / gridSize) * gridSize);
      }
      if (resizeHandle.includes('n')) {
        const deltaY = currentY - resizeStart.y;
        newY = Math.round((resizeStart.posY + deltaY) / gridSize) * gridSize;
        newHeight = resizeStart.height - (newY - resizeStart.posY);
        if (newHeight < 30) {
          newHeight = 30;
          newY = resizeStart.posY + resizeStart.height - 30;
        }
      }
      
      setRoomPositions(prev =>
        prev.map(p => p.roomId === resizingRoom ? { ...p, x: newX, y: newY, width: newWidth, height: newHeight } : p)
      );
    }
  }, [draggingRoom, dragOffset, pan, zoom, selectedFloorPlan, resizingRoom, resizeHandle, resizeStart]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, roomId: string, handle: string) => {
    e.stopPropagation();
    const position = getRoomPosition(roomId);
    if (!position) return;
    
    const rect = editorRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setResizingRoom(roomId);
    setResizeHandle(handle);
    setResizeStart({
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
      width: position.width,
      height: position.height,
      posX: position.x,
      posY: position.y,
    });
    setSelectedRoom(roomId);
  }, [pan, zoom, roomPositions]);

  // Add room to canvas
  const addRoomToCanvas = (room: Room) => {
    const existingPosition = getRoomPosition(room.id);
    if (existingPosition) {
      toast({
        title: 'Info',
        description: 'This room is already on the floor plan',
      });
      return;
    }

    const gridSize = selectedFloorPlan?.gridSize || 20;
    const width = defaultRoomSize.width;
    const height = defaultRoomSize.height;
    
    // Find a free position
    let x = 20;
    let y = 20;
    const canvasWidth = selectedFloorPlan?.width || 800;
    const canvasHeight = selectedFloorPlan?.height || 600;
    
    while (roomPositions.some(p => 
      p.x === x && p.y === y
    )) {
      x += width + gridSize;
      if (x + width > canvasWidth) {
        x = 20;
        y += height + gridSize;
      }
    }

    const newPositions = [...roomPositions, {
      roomId: room.id,
      x,
      y,
      width,
      height,
      rotation: 0,
    }];
    
    setRoomPositions(newPositions);
    pushToHistory(newPositions);
    setIsRoomMapOpen(false);
  };

  // Remove room from canvas
  const removeRoomFromCanvas = (roomId: string) => {
    const newPositions = roomPositions.filter(p => p.roomId !== roomId);
    setRoomPositions(newPositions);
    pushToHistory(newPositions);
    setSelectedRoom(null);
  };

  // Duplicate room
  const duplicateRoom = useCallback((roomId: string) => {
    const position = getRoomPosition(roomId);
    const room = getRoomById(roomId);
    if (!position || !room) return;
    
    // Create a virtual duplicate by adding offset
    const newPositions = roomPositions.map(p => 
      p.roomId === roomId 
        ? { ...p, x: p.x + 20, y: p.y + 20 }
        : p
    );
    
    setRoomPositions(newPositions);
    pushToHistory(newPositions);
    
    toast({
      title: 'Duplicated',
      description: `Room ${room.number} duplicated`,
    });
  }, [roomPositions, pushToHistory]);

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Filter floor plans
  const filteredFloorPlans = floorPlans.filter(fp => 
    fp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fp.property.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group floor plans by property
  const floorPlansByProperty = filteredFloorPlans.reduce((acc, fp) => {
    const propertyName = fp.property.name;
    if (!acc[propertyName]) acc[propertyName] = [];
    acc[propertyName].push(fp);
    return acc;
  }, {} as Record<string, FloorPlan[]>);

  // Stats
  const stats = {
    total: floorPlans.length,
    properties: new Set(floorPlans.map(fp => fp.propertyId)).size,
    floors: floorPlans.length,
  };

  // List View
  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Map className="h-5 w-5" />
              Floor Plans
            </h2>
            <p className="text-sm text-muted-foreground">
              Visual floor plan management and room layout editor
            </p>
          </div>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Floor Plan
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-3">
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Floor Plans</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.properties}</div>
            <div className="text-xs text-muted-foreground">Properties</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.floors}</div>
            <div className="text-xs text-muted-foreground">Floors Mapped</div>
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
                    placeholder="Search floor plans..."
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
            </div>
          </CardContent>
        </Card>

        {/* Floor Plans List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredFloorPlans.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Layers className="h-12 w-12 mb-4" />
              <p>No floor plans found</p>
              <p className="text-sm">Create your first floor plan to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(floorPlansByProperty).map(([propertyName, propertyFloorPlans]) => (
              <Card key={propertyName}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    {propertyName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {propertyFloorPlans.map((floorPlan) => (
                      <div
                        key={floorPlan.id}
                        className="border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold">{floorPlan.name}</div>
                            <div className="text-sm text-muted-foreground">Floor {floorPlan.floor}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {floorPlan.width} × {floorPlan.height} px
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => { e.stopPropagation(); openEditor(floorPlan); }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Floor Plan</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => { e.stopPropagation(); openViewer(floorPlan); }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View Only</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={(e) => { e.stopPropagation(); openDeleteDialog(floorPlan); }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {JSON.parse(floorPlan.roomPositions || '[]').length} rooms placed
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Floor Plan</DialogTitle>
              <DialogDescription>Create a new floor plan for visual room layout</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Property *</Label>
                <Select value={formData.propertyId} onValueChange={(v) => setFormData(prev => ({ ...prev, propertyId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map(property => (
                      <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Floor Number *</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.floor}
                  onChange={(e) => setFormData(prev => ({ ...prev, floor: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., First Floor Plan"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Width (px)</Label>
                  <Input
                    type="number"
                    value={formData.width}
                    onChange={(e) => setFormData(prev => ({ ...prev, width: parseInt(e.target.value) || 800 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height (px)</Label>
                  <Input
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData(prev => ({ ...prev, height: parseInt(e.target.value) || 600 }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Grid Size (px)</Label>
                <Input
                  type="number"
                  min={10}
                  max={50}
                  value={formData.gridSize}
                  onChange={(e) => setFormData(prev => ({ ...prev, gridSize: parseInt(e.target.value) || 20 }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={isSavingDialog}>
                {isSavingDialog && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Floor Plan</DialogTitle>
              <DialogDescription>Update floor plan settings</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Width (px)</Label>
                  <Input
                    type="number"
                    value={formData.width}
                    onChange={(e) => setFormData(prev => ({ ...prev, width: parseInt(e.target.value) || 800 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height (px)</Label>
                  <Input
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData(prev => ({ ...prev, height: parseInt(e.target.value) || 600 }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Grid Size (px)</Label>
                <Input
                  type="number"
                  min={10}
                  max={50}
                  value={formData.gridSize}
                  onChange={(e) => setFormData(prev => ({ ...prev, gridSize: parseInt(e.target.value) || 20 }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={isSavingDialog}>
                {isSavingDialog && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Floor Plan</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{selectedFloorPlan?.name}&quot;? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSavingDialog}>
                {isSavingDialog && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Editor View
  const isViewer = viewMode === 'viewer';
  
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Editor Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b bg-background px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => setViewMode('list')} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <Map className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="font-semibold text-sm truncate">{selectedFloorPlan?.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {!isViewer && (
            <>
              <Button variant="outline" size="icon" className="h-9 w-9 min-h-[44px]" onClick={undo} disabled={historyIndex <= 0}>
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9 min-h-[44px]" onClick={redo} disabled={historyIndex >= history.length - 1}>
                <Redo2 className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-border mx-0.5" />
              <Button variant="outline" size="sm" className="h-9 min-h-[44px] text-xs" onClick={autoArrangeRooms}>
                <Wand2 className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Auto</span>
              </Button>
              <Button variant="outline" size="sm" className="h-9 min-h-[44px] text-xs" onClick={() => setIsRoomMapOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Add</span>
              </Button>
              <Button size="sm" className="h-9 min-h-[44px] text-xs" onClick={saveRoomPositions} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <Save className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Save</span>
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="h-9 min-h-[44px] text-xs" onClick={exportAsImage}>
            <Download className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Room List */}
        <div className="w-64 border-r bg-muted/30 flex flex-col">
          <div className="p-3 border-b bg-background">
            <h3 className="font-semibold text-sm">Rooms on Floor</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {rooms.length} total, {roomPositions.length} placed
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {rooms.map(room => {
                const isPlaced = roomPositions.some(p => p.roomId === room.id);
                const statusInfo = getStatusInfo(room.status);
                return (
                  <div
                    key={room.id}
                    className={cn(
                      "p-2 rounded border cursor-pointer hover:bg-muted/50 transition-colors",
                      selectedRoom === room.id && "border-primary bg-primary/10"
                    )}
                    onClick={() => setSelectedRoom(room.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded", statusInfo.color)} />
                      <span className="font-medium text-sm">{room.number}</span>
                      <Badge variant="outline" className="text-xs">{room.roomType.code}</Badge>
                      {isPlaced && <Badge variant="secondary" className="text-xs ml-auto">Placed</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{statusInfo.label}</div>
                  </div>
                );
              })}
              {rooms.length === 0 && (
                <div className="text-center text-muted-foreground py-4 text-sm">
                  No rooms on this floor
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-2 p-2 border-b bg-background">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom Out</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="w-24 text-center text-sm">{Math.round(zoom * 100)}%</div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom In</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleZoomReset}>
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset View</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="w-px h-6 bg-border mx-2" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showGrid ? 'secondary' : 'outline'}
                    size="icon"
                    onClick={() => setShowGrid(!showGrid)}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Grid</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="flex-1" />
            {!isViewer && selectedRoom && (
              <>
                <Button variant="outline" size="sm" onClick={() => duplicateRoom(selectedRoom)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </Button>
                <Button variant="outline" size="sm" onClick={() => removeRoomFromCanvas(selectedRoom)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </>
            )}
          </div>

          {/* Canvas */}
          <div
            ref={editorRef}
            className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-900 relative"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={(e) => {
              handleCanvasMouseMove(e);
              handleRoomMouseMove(e);
            }}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <div
              ref={canvasRef}
              className="canvas-bg absolute"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'top left',
                width: selectedFloorPlan?.width || 800,
                height: selectedFloorPlan?.height || 600,
              }}
            >
              {/* Background Image */}
              {selectedFloorPlan?.imageUrl && (
                <img
                  src={selectedFloorPlan.imageUrl}
                  alt="Floor plan background"
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}

              {/* Grid */}
              {showGrid && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <defs>
                    <pattern
                      id="grid"
                      width={selectedFloorPlan?.gridSize || 20}
                      height={selectedFloorPlan?.gridSize || 20}
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d={`M ${selectedFloorPlan?.gridSize || 20} 0 L 0 0 0 ${selectedFloorPlan?.gridSize || 20}`}
                        fill="none"
                        stroke="currentColor"
                        strokeOpacity={0.15}
                        strokeWidth={0.5}
                      />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              )}

              {/* Border */}
              <div className="absolute inset-0 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg" />

              {/* Room Blocks */}
              {roomPositions.map((position) => {
                const room = getRoomById(position.roomId);
                if (!room) return null;

                const statusInfo = getStatusInfo(room.status);
                const isSelected = selectedRoom === position.roomId;
                const isDraggingThis = draggingRoom === position.roomId;
                const isResizingThis = resizingRoom === position.roomId;

                return (
                  <TooltipProvider key={position.roomId}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "absolute rounded-lg border-2 flex flex-col items-center justify-center transition-shadow group",
                            "bg-background hover:shadow-lg",
                            statusInfo.borderColor,
                            isSelected && "ring-2 ring-primary ring-offset-2",
                            (isDraggingThis || isResizingThis) && "shadow-xl z-10",
                            !isViewer && "cursor-move"
                          )}
                          style={{
                            left: position.x,
                            top: position.y,
                            width: position.width,
                            height: position.height,
                          }}
                          onMouseDown={!isViewer ? (e) => handleRoomMouseDown(e, position.roomId) : undefined}
                        >
                          <div className={cn("w-3 h-3 rounded-full mb-1", statusInfo.color)} />
                          <span className="font-bold text-sm">{room.number}</span>
                          <span className="text-xs text-muted-foreground">{room.roomType.code}</span>
                          
                          {/* Resize Handles */}
                          {!isViewer && isSelected && (
                            <>
                              {/* Corner handles */}
                              <div
                                className="absolute w-3 h-3 bg-primary rounded-full cursor-nwse-resize -top-1 -left-1"
                                onMouseDown={(e) => handleResizeStart(e, position.roomId, 'nw')}
                              />
                              <div
                                className="absolute w-3 h-3 bg-primary rounded-full cursor-nesw-resize -top-1 -right-1"
                                onMouseDown={(e) => handleResizeStart(e, position.roomId, 'ne')}
                              />
                              <div
                                className="absolute w-3 h-3 bg-primary rounded-full cursor-nesw-resize -bottom-1 -left-1"
                                onMouseDown={(e) => handleResizeStart(e, position.roomId, 'sw')}
                              />
                              <div
                                className="absolute w-3 h-3 bg-primary rounded-full cursor-nwse-resize -bottom-1 -right-1"
                                onMouseDown={(e) => handleResizeStart(e, position.roomId, 'se')}
                              />
                              {/* Edge handles */}
                              <div
                                className="absolute w-6 h-2 bg-primary rounded cursor-ns-resize -top-1 left-1/2 -translate-x-1/2"
                                onMouseDown={(e) => handleResizeStart(e, position.roomId, 'n')}
                              />
                              <div
                                className="absolute w-6 h-2 bg-primary rounded cursor-ns-resize -bottom-1 left-1/2 -translate-x-1/2"
                                onMouseDown={(e) => handleResizeStart(e, position.roomId, 's')}
                              />
                              <div
                                className="absolute w-2 h-6 bg-primary rounded cursor-ew-resize -left-1 top-1/2 -translate-y-1/2"
                                onMouseDown={(e) => handleResizeStart(e, position.roomId, 'w')}
                              />
                              <div
                                className="absolute w-2 h-6 bg-primary rounded cursor-ew-resize -right-1 top-1/2 -translate-y-1/2"
                                onMouseDown={(e) => handleResizeStart(e, position.roomId, 'e')}
                              />
                            </>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="w-48">
                        <div className="space-y-1">
                          <div className="font-semibold">Room {room.number}</div>
                          <div className="text-xs">{room.roomType.name}</div>
                          <div className="flex items-center gap-2 text-xs">
                            <div className={cn("w-2 h-2 rounded", statusInfo.color)} />
                            {statusInfo.label}
                          </div>
                          {room.name && (
                            <div className="text-xs text-muted-foreground">{room.name}</div>
                          )}
                          <div className="text-xs text-muted-foreground pt-1">
                            Position: ({position.x}, {position.y}) | Size: {position.width}×{position.height}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}

              {/* Empty State */}
              {roomPositions.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <DoorOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No rooms placed yet</p>
                    <p className="text-sm">Click &quot;Add Room&quot; to start placing rooms</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-4 p-2 border-t bg-background">
            <Move className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Pan: Click & drag canvas</span>
            {!isViewer && (
              <>
                <div className="w-px h-4 bg-border" />
                <span className="text-xs text-muted-foreground">Resize: Select room & drag handles</span>
              </>
            )}
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">Zoom:</span>
            <Slider
              value={[zoom * 100]}
              min={50}
              max={200}
              step={10}
              className="w-32"
              onValueChange={(v) => setZoom(v[0] / 100)}
            />
          </div>
        </div>

        {/* Right Panel - Selected Room Details */}
        {selectedRoom && (
          <div className="w-64 border-l bg-muted/30">
            <div className="p-3 border-b bg-background">
              <h3 className="font-semibold text-sm">Room Details</h3>
            </div>
            <div className="p-3 space-y-3">
              {(() => {
                const room = getRoomById(selectedRoom);
                const position = getRoomPosition(selectedRoom);
                if (!room || !position) return null;

                const statusInfo = getStatusInfo(room.status);

                return (
                  <>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-4 h-4 rounded", statusInfo.color)} />
                      <div>
                        <div className="font-bold">{room.number}</div>
                        <div className="text-xs text-muted-foreground">{room.roomType.name}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>Status: </span>
                        <Badge variant="outline">{statusInfo.label}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>Floor {room.floor}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Position: ({position.x}, {position.y})</span>
                      </div>
                    </div>

                    {!isViewer && (
                      <>
                        <div className="pt-2 border-t">
                          <Label className="text-xs text-muted-foreground">Position</Label>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div>
                              <Label className="text-xs">X</Label>
                              <Input
                                type="number"
                                value={position.x}
                                onChange={(e) => {
                                  const newX = parseInt(e.target.value) || 0;
                                  const newPositions = roomPositions.map(p => 
                                    p.roomId === selectedRoom ? { ...p, x: newX } : p
                                  );
                                  setRoomPositions(newPositions);
                                  pushToHistory(newPositions);
                                }}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Y</Label>
                              <Input
                                type="number"
                                value={position.y}
                                onChange={(e) => {
                                  const newY = parseInt(e.target.value) || 0;
                                  const newPositions = roomPositions.map(p => 
                                    p.roomId === selectedRoom ? { ...p, y: newY } : p
                                  );
                                  setRoomPositions(newPositions);
                                  pushToHistory(newPositions);
                                }}
                                className="h-8"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t">
                          <Label className="text-xs text-muted-foreground">Size</Label>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div>
                              <Label className="text-xs">Width</Label>
                              <Input
                                type="number"
                                value={position.width}
                                onChange={(e) => {
                                  const newWidth = parseInt(e.target.value) || defaultRoomSize.width;
                                  const newPositions = roomPositions.map(p => 
                                    p.roomId === selectedRoom ? { ...p, width: newWidth } : p
                                  );
                                  setRoomPositions(newPositions);
                                  pushToHistory(newPositions);
                                }}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Height</Label>
                              <Input
                                type="number"
                                value={position.height}
                                onChange={(e) => {
                                  const newHeight = parseInt(e.target.value) || defaultRoomSize.height;
                                  const newPositions = roomPositions.map(p => 
                                    p.roomId === selectedRoom ? { ...p, height: newHeight } : p
                                  );
                                  setRoomPositions(newPositions);
                                  pushToHistory(newPositions);
                                }}
                                className="h-8"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Room Mapping Dialog */}
      <Dialog open={isRoomMapOpen} onOpenChange={setIsRoomMapOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Room to Floor Plan</DialogTitle>
            <DialogDescription>Select a room to place on the floor plan</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            <div className="space-y-2 p-1">
              {rooms.filter(r => !roomPositions.some(p => p.roomId === r.id)).map(room => {
                const statusInfo = getStatusInfo(room.status);
                return (
                  <div
                    key={room.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => addRoomToCanvas(room)}
                  >
                    <div className={cn("w-4 h-4 rounded", statusInfo.color)} />
                    <div className="flex-1">
                      <div className="font-medium">{room.number}</div>
                      <div className="text-xs text-muted-foreground">{room.roomType.name}</div>
                    </div>
                    <Badge variant="outline">{statusInfo.label}</Badge>
                  </div>
                );
              })}
              {rooms.filter(r => !roomPositions.some(p => p.roomId === r.id)).length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  All rooms have been placed
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* Hidden canvas for export */}
      <canvas ref={exportCanvasRef} className="hidden" />
    </div>
  );
}
