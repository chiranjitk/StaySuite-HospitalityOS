'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ZoomIn,
  ZoomOut,
  Move,
  Grid3X3,
  Save,
  Maximize2,
  DoorOpen,
  Undo2,
  Redo2,
  Wand2,
  Download,
  Trash2,
  Copy,
  Layers,
  AlignStartVertical,
  AlignStartHorizontal,
  Group,
  Ungroup,
  Lock,
  Unlock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
  locked?: boolean;
}

interface FloorPlanData {
  id: string;
  name: string;
  width: number;
  height: number;
  gridSize: number;
  imageUrl?: string;
}

interface FloorPlanEditorProps {
  floorPlan: FloorPlanData;
  rooms: Room[];
  initialPositions: RoomPosition[];
  onSave: (positions: RoomPosition[]) => Promise<void>;
  onExport?: (dataUrl: string) => void;
  readOnly?: boolean;
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

export function FloorPlanEditor({
  floorPlan,
  rooms,
  initialPositions,
  onSave,
  onExport,
  readOnly = false,
}: FloorPlanEditorProps) {
  const { toast } = useToast();
  
  // Editor states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [roomPositions, setRoomPositions] = useState<RoomPosition[]>(initialPositions);
  const [isSaving, setIsSaving] = useState(false);
  const [draggingRoom, setDraggingRoom] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Resizing states
  const [resizingRoom, setResizingRoom] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  
  // Multi-select states
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState({ startX: 0, startY: 0, endX: 0, endY: 0 });
  
  // History for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([{ roomPositions: initialPositions }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Dialog state
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // History management
  const pushToHistory = useCallback((positions: RoomPosition[]) => {
    const newState: HistoryState = { roomPositions: JSON.parse(JSON.stringify(positions)) };
    const newHistory = [...history.slice(0, historyIndex + 1), newState];
    if (newHistory.length > 50) newHistory.shift();
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
      if (readOnly) return;
      
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
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedRooms(roomPositions.map(p => p.roomId));
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedRooms.length > 0) {
          e.preventDefault();
          removeSelectedRooms();
        }
      }
      if (e.key === 'Escape') {
        setSelectedRooms([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, undo, redo, selectedRooms, roomPositions, handleSave, removeSelectedRooms]);

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
    if (readOnly) return;
    
    const target = e.target as HTMLElement;
    if (target === canvasRef.current || target.classList.contains('canvas-bg') || target.tagName === 'svg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedRooms([]);
      
      // Start selection box
      if (e.shiftKey) {
        const rect = editorRef.current?.getBoundingClientRect();
        if (rect) {
          setIsSelecting(true);
          const startX = (e.clientX - rect.left - pan.x) / zoom;
          const startY = (e.clientY - rect.top - pan.y) / zoom;
          setSelectionBox({ startX, startY, endX: startX, endY: startY });
        }
      }
    }
  }, [pan, zoom, readOnly]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && !draggingRoom && !resizingRoom) {
      if (isSelecting) {
        const rect = editorRef.current?.getBoundingClientRect();
        if (rect) {
          const endX = (e.clientX - rect.left - pan.x) / zoom;
          const endY = (e.clientY - rect.top - pan.y) / zoom;
          setSelectionBox(prev => ({ ...prev, endX, endY }));
        }
      } else {
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      }
    }
  }, [isDragging, dragStart, draggingRoom, resizingRoom, isSelecting, zoom]);

  const handleCanvasMouseUp = useCallback(() => {
    if (isSelecting && selectionBox.startX !== selectionBox.endX) {
      // Find rooms in selection box
      const minX = Math.min(selectionBox.startX, selectionBox.endX);
      const maxX = Math.max(selectionBox.startX, selectionBox.endX);
      const minY = Math.min(selectionBox.startY, selectionBox.endY);
      const maxY = Math.max(selectionBox.startY, selectionBox.endY);
      
      const selected = roomPositions
        .filter(p => 
          p.x >= minX && p.x + p.width <= maxX &&
          p.y >= minY && p.y + p.height <= maxY
        )
        .map(p => p.roomId);
      
      setSelectedRooms(selected);
      setIsSelecting(false);
    }
    
    if (draggingRoom || resizingRoom) {
      pushToHistory(roomPositions);
    }
    setIsDragging(false);
    setDraggingRoom(null);
    setResizingRoom(null);
    setResizeHandle(null);
    setIsSelecting(false);
  }, [draggingRoom, resizingRoom, roomPositions, pushToHistory, isSelecting, selectionBox]);

  // Handle room drag
  const handleRoomMouseDown = useCallback((e: React.MouseEvent, roomId: string) => {
    if (readOnly) return;
    e.stopPropagation();
    
    const position = getRoomPosition(roomId);
    if (!position || position.locked) return;

    const rect = editorRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.shiftKey && selectedRooms.includes(roomId)) {
      // Drag all selected rooms
    } else if (!selectedRooms.includes(roomId)) {
      setSelectedRooms([roomId]);
    }

    setDraggingRoom(roomId);
    setDragOffset({
      x: (e.clientX - rect.left - pan.x) / zoom - position.x,
      y: (e.clientY - rect.top - pan.y) / zoom - position.y,
    });
  }, [pan, zoom, roomPositions, selectedRooms, readOnly]);

  const handleRoomMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingRoom) {
      const rect = editorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const gridSize = floorPlan.gridSize || 20;
      let newX = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      let newY = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;

      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;

      const position = getRoomPosition(draggingRoom);
      if (position) {
        const maxX = floorPlan.width - position.width;
        const maxY = floorPlan.height - position.height;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
      }

      // Calculate delta for multi-select drag
      const deltaX = position ? newX - position.x : 0;
      const deltaY = position ? newY - position.y : 0;

      setRoomPositions(prev => {
        if (selectedRooms.length > 1 && selectedRooms.includes(draggingRoom)) {
          return prev.map(p => 
            selectedRooms.includes(p.roomId) && !p.locked
              ? { ...p, x: p.x + deltaX, y: p.y + deltaY }
              : p
          );
        }
        return prev.map(p => p.roomId === draggingRoom ? { ...p, x: newX, y: newY } : p);
      });
    }
    
    if (resizingRoom && resizeHandle) {
      const rect = editorRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const currentX = (e.clientX - rect.left - pan.x) / zoom;
      const currentY = (e.clientY - rect.top - pan.y) / zoom;
      const gridSize = floorPlan.gridSize || 20;
      
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
  }, [draggingRoom, dragOffset, pan, zoom, floorPlan, resizingRoom, resizeHandle, resizeStart, selectedRooms]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, roomId: string, handle: string) => {
    if (readOnly) return;
    e.stopPropagation();
    const position = getRoomPosition(roomId);
    if (!position || position.locked) return;
    
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
    setSelectedRooms([roomId]);
  }, [pan, zoom, roomPositions, readOnly]);

  // Add room to canvas
  const addRoomToCanvas = useCallback((room: Room) => {
    if (roomPositions.some(p => p.roomId === room.id)) {
      toast({ title: 'Info', description: 'This room is already on the floor plan' });
      return;
    }

    const gridSize = floorPlan.gridSize || 20;
    let x = 20;
    let y = 20;
    
    while (roomPositions.some(p => p.x === x && p.y === y)) {
      x += defaultRoomSize.width + gridSize;
      if (x + defaultRoomSize.width > floorPlan.width) {
        x = 20;
        y += defaultRoomSize.height + gridSize;
      }
    }

    const newPositions = [...roomPositions, {
      roomId: room.id,
      x,
      y,
      width: defaultRoomSize.width,
      height: defaultRoomSize.height,
      rotation: 0,
      locked: false,
    }];
    
    setRoomPositions(newPositions);
    pushToHistory(newPositions);
    setIsAddRoomOpen(false);
  }, [roomPositions, floorPlan, pushToHistory, toast]);

  // Remove selected rooms
  const removeSelectedRooms = useCallback(() => {
    const newPositions = roomPositions.filter(p => !selectedRooms.includes(p.roomId));
    setRoomPositions(newPositions);
    pushToHistory(newPositions);
    setSelectedRooms([]);
  }, [roomPositions, selectedRooms, pushToHistory]);

  // Toggle room lock
  const toggleRoomLock = useCallback((roomId: string) => {
    const newPositions = roomPositions.map(p => 
      p.roomId === roomId ? { ...p, locked: !p.locked } : p
    );
    setRoomPositions(newPositions);
    pushToHistory(newPositions);
  }, [roomPositions, pushToHistory]);

  // Auto-arrange rooms
  const autoArrangeRooms = useCallback(() => {
    const gridSize = floorPlan.gridSize || 20;
    const padding = 20;
    const spacing = 10;
    
    const availableWidth = floorPlan.width - (padding * 2);
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
        locked: false,
      };
    });
    
    setRoomPositions(newPositions);
    pushToHistory(newPositions);
    toast({ title: 'Auto-arranged', description: `Arranged ${rooms.length} rooms in a grid layout` });
  }, [rooms, floorPlan, pushToHistory, toast]);

  // Align selected rooms
  const alignRooms = useCallback((direction: 'left' | 'right' | 'top' | 'bottom' | 'h-center' | 'v-center') => {
    if (selectedRooms.length < 2) return;
    
    const selectedPositions = roomPositions.filter(p => selectedRooms.includes(p.roomId));
    if (selectedPositions.length === 0) return;
    
    let newPositions = [...roomPositions];
    
    switch (direction) {
      case 'left': {
        const minX = Math.min(...selectedPositions.map(p => p.x));
        newPositions = newPositions.map(p => 
          selectedRooms.includes(p.roomId) ? { ...p, x: minX } : p
        );
        break;
      }
      case 'right': {
        const maxX = Math.max(...selectedPositions.map(p => p.x + p.width));
        newPositions = newPositions.map(p => 
          selectedRooms.includes(p.roomId) ? { ...p, x: maxX - p.width } : p
        );
        break;
      }
      case 'top': {
        const minY = Math.min(...selectedPositions.map(p => p.y));
        newPositions = newPositions.map(p => 
          selectedRooms.includes(p.roomId) ? { ...p, y: minY } : p
        );
        break;
      }
      case 'bottom': {
        const maxY = Math.max(...selectedPositions.map(p => p.y + p.height));
        newPositions = newPositions.map(p => 
          selectedRooms.includes(p.roomId) ? { ...p, y: maxY - p.height } : p
        );
        break;
      }
      case 'h-center': {
        const centerX = selectedPositions.reduce((sum, p) => sum + p.x + p.width / 2, 0) / selectedPositions.length;
        newPositions = newPositions.map(p => 
          selectedRooms.includes(p.roomId) ? { ...p, x: centerX - p.width / 2 } : p
        );
        break;
      }
      case 'v-center': {
        const centerY = selectedPositions.reduce((sum, p) => sum + p.y + p.height / 2, 0) / selectedPositions.length;
        newPositions = newPositions.map(p => 
          selectedRooms.includes(p.roomId) ? { ...p, y: centerY - p.height / 2 } : p
        );
        break;
      }
    }
    
    setRoomPositions(newPositions);
    pushToHistory(newPositions);
  }, [roomPositions, selectedRooms, pushToHistory]);

  // Export as image
  const handleExport = useCallback(async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = floorPlan.width * 2;
    canvas.height = floorPlan.height * 2;
    ctx.scale(2, 2);
    
    // Draw background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, floorPlan.width, floorPlan.height);
    
    // Draw grid
    const gridSize = floorPlan.gridSize || 20;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= floorPlan.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, floorPlan.height);
      ctx.stroke();
    }
    for (let y = 0; y <= floorPlan.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(floorPlan.width, y);
      ctx.stroke();
    }
    
    // Draw rooms
    roomPositions.forEach(position => {
      const room = getRoomById(position.roomId);
      if (!room) return;
      
      const statusInfo = getStatusInfo(room.status);
      
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = statusInfo.color.includes('emerald') ? '#10b981' :
                        statusInfo.color.includes('blue') ? '#3b82f6' :
                        statusInfo.color.includes('yellow') ? '#eab308' :
                        statusInfo.color.includes('orange') ? '#f97316' : '#ef4444';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.roundRect(position.x, position.y, position.width, position.height, 8);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(position.x + position.width / 2, position.y + 12, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(room.number, position.x + position.width / 2, position.y + position.height / 2 + 4);
      
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText(room.roomType.code, position.x + position.width / 2, position.y + position.height / 2 + 16);
    });
    
    const dataUrl = canvas.toDataURL('image/png');
    
    if (onExport) {
      onExport(dataUrl);
    } else {
      const link = document.createElement('a');
      link.download = `${floorPlan.name.replace(/\s+/g, '_')}_floorplan.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: 'Exported', description: 'Floor plan exported as PNG image' });
    }
  }, [roomPositions, rooms, floorPlan, onExport, toast]);

  // Save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(roomPositions);
      toast({ title: 'Saved', description: 'Floor plan saved successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save floor plan', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [roomPositions, onSave, toast]);

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-background flex-wrap">
        <div className="flex items-center gap-1">
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
          <div className="w-16 text-center text-sm">{Math.round(zoom * 100)}%</div>
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
        </div>

        <div className="w-px h-6 bg-border" />

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

        {!readOnly && (
          <>
            <div className="w-px h-6 bg-border" />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={undo} disabled={historyIndex <= 0}>
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={redo} disabled={historyIndex >= history.length - 1}>
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="w-px h-6 bg-border" />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={autoArrangeRooms}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Auto-Arrange
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Arrange all rooms in a grid</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button variant="outline" size="sm" onClick={() => setIsAddRoomOpen(true)}>
              Add Room
            </Button>

            {selectedRooms.length > 0 && (
              <>
                <div className="w-px h-6 bg-border" />
                
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => alignRooms('left')}>
                          <AlignStartVertical className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Align Left</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => alignRooms('h-center')}>
                          <AlignStartVertical className="h-4 w-4 rotate-90" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Align Center (H)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => alignRooms('top')}>
                          <AlignStartHorizontal className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Align Top</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" onClick={removeSelectedRooms}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete Selected</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </>
        )}

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        
        {!readOnly && (
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        )}
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 border-r bg-muted/30 flex flex-col">
          <div className="p-3 border-b bg-background">
            <h3 className="font-semibold text-sm">Rooms</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {rooms.length} total, {roomPositions.length} placed
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {rooms.map(room => {
                const isPlaced = roomPositions.some(p => p.roomId === room.id);
                const statusInfo = getStatusInfo(room.status);
                const position = getRoomPosition(room.id);
                const isSelected = selectedRooms.includes(room.id);
                const isLocked = position?.locked;
                
                return (
                  <div
                    key={room.id}
                    className={cn(
                      "p-2 rounded border cursor-pointer hover:bg-muted/50 transition-colors",
                      isSelected && "border-primary bg-primary/10"
                    )}
                    onClick={() => setSelectedRooms([room.id])}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded", statusInfo.color)} />
                      <span className="font-medium text-sm">{room.number}</span>
                      <Badge variant="outline" className="text-xs">{room.roomType.code}</Badge>
                      {isLocked && <Lock className="h-3 w-3 text-muted-foreground ml-auto" />}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{statusInfo.label}</span>
                      {isPlaced && <Badge variant="secondary" className="text-xs">Placed</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
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
          style={{ cursor: readOnly ? 'default' : isDragging ? 'grabbing' : 'grab' }}
        >
          <div
            ref={canvasRef}
            className="canvas-bg absolute"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top left',
              width: floorPlan.width,
              height: floorPlan.height,
            }}
          >
            {/* Background Image */}
            {floorPlan.imageUrl && (
              <img
                src={floorPlan.imageUrl}
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
                    width={floorPlan.gridSize}
                    height={floorPlan.gridSize}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M ${floorPlan.gridSize} 0 L 0 0 0 ${floorPlan.gridSize}`}
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

            {/* Selection Box */}
            {isSelecting && (
              <div
                className="absolute border-2 border-primary bg-primary/10"
                style={{
                  left: Math.min(selectionBox.startX, selectionBox.endX),
                  top: Math.min(selectionBox.startY, selectionBox.endY),
                  width: Math.abs(selectionBox.endX - selectionBox.startX),
                  height: Math.abs(selectionBox.endY - selectionBox.startY),
                }}
              />
            )}

            {/* Room Blocks */}
            {roomPositions.map((position) => {
              const room = getRoomById(position.roomId);
              if (!room) return null;

              const statusInfo = getStatusInfo(room.status);
              const isSelected = selectedRooms.includes(position.roomId);
              const isDraggingThis = draggingRoom === position.roomId;
              const isResizingThis = resizingRoom === position.roomId;
              const isLocked = position.locked;

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
                          isLocked && "opacity-70",
                          !readOnly && !isLocked && "cursor-move"
                        )}
                        style={{
                          left: position.x,
                          top: position.y,
                          width: position.width,
                          height: position.height,
                        }}
                        onMouseDown={!readOnly && !isLocked ? (e) => handleRoomMouseDown(e, position.roomId) : undefined}
                      >
                        <div className={cn("w-3 h-3 rounded-full mb-1", statusInfo.color)} />
                        <span className="font-bold text-sm">{room.number}</span>
                        <span className="text-xs text-muted-foreground">{room.roomType.code}</span>
                        
                        {isLocked && (
                          <Lock className="absolute top-1 right-1 h-3 w-3 text-muted-foreground" />
                        )}
                        
                        {/* Resize Handles */}
                        {!readOnly && isSelected && !isLocked && (
                          <>
                            <div className="absolute w-3 h-3 bg-primary rounded-full cursor-nwse-resize -top-1 -left-1" onMouseDown={(e) => handleResizeStart(e, position.roomId, 'nw')} />
                            <div className="absolute w-3 h-3 bg-primary rounded-full cursor-nesw-resize -top-1 -right-1" onMouseDown={(e) => handleResizeStart(e, position.roomId, 'ne')} />
                            <div className="absolute w-3 h-3 bg-primary rounded-full cursor-nesw-resize -bottom-1 -left-1" onMouseDown={(e) => handleResizeStart(e, position.roomId, 'sw')} />
                            <div className="absolute w-3 h-3 bg-primary rounded-full cursor-nwse-resize -bottom-1 -right-1" onMouseDown={(e) => handleResizeStart(e, position.roomId, 'se')} />
                            <div className="absolute w-6 h-2 bg-primary rounded cursor-ns-resize -top-1 left-1/2 -translate-x-1/2" onMouseDown={(e) => handleResizeStart(e, position.roomId, 'n')} />
                            <div className="absolute w-6 h-2 bg-primary rounded cursor-ns-resize -bottom-1 left-1/2 -translate-x-1/2" onMouseDown={(e) => handleResizeStart(e, position.roomId, 's')} />
                            <div className="absolute w-2 h-6 bg-primary rounded cursor-ew-resize -left-1 top-1/2 -translate-y-1/2" onMouseDown={(e) => handleResizeStart(e, position.roomId, 'w')} />
                            <div className="absolute w-2 h-6 bg-primary rounded cursor-ew-resize -right-1 top-1/2 -translate-y-1/2" onMouseDown={(e) => handleResizeStart(e, position.roomId, 'e')} />
                          </>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <div className="font-semibold">Room {room.number}</div>
                        <div className="text-xs">{room.roomType.name}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className={cn("w-2 h-2 rounded", statusInfo.color)} />
                          {statusInfo.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
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
                  <p className="text-sm">Click &quot;Add Room&quot; to start</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Properties Panel */}
        {selectedRooms.length === 1 && !readOnly && (
          <div className="w-56 border-l bg-muted/30">
            <div className="p-3 border-b bg-background">
              <h3 className="font-semibold text-sm">Properties</h3>
            </div>
            <div className="p-3 space-y-3">
              {(() => {
                const roomId = selectedRooms[0];
                const room = getRoomById(roomId);
                const position = getRoomPosition(roomId);
                if (!room || !position) return null;

                return (
                  <>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-4 h-4 rounded", getStatusInfo(room.status).color)} />
                      <div>
                        <div className="font-bold">{room.number}</div>
                        <div className="text-xs text-muted-foreground">{room.roomType.name}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">X</Label>
                        <Input
                          type="number"
                          value={position.x}
                          onChange={(e) => {
                            const newX = parseInt(e.target.value) || 0;
                            const newPositions = roomPositions.map(p => p.roomId === roomId ? { ...p, x: newX } : p);
                            setRoomPositions(newPositions);
                            pushToHistory(newPositions);
                          }}
                          className="h-8"
                          disabled={position.locked}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Y</Label>
                        <Input
                          type="number"
                          value={position.y}
                          onChange={(e) => {
                            const newY = parseInt(e.target.value) || 0;
                            const newPositions = roomPositions.map(p => p.roomId === roomId ? { ...p, y: newY } : p);
                            setRoomPositions(newPositions);
                            pushToHistory(newPositions);
                          }}
                          className="h-8"
                          disabled={position.locked}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Width</Label>
                        <Input
                          type="number"
                          value={position.width}
                          onChange={(e) => {
                            const newWidth = parseInt(e.target.value) || defaultRoomSize.width;
                            const newPositions = roomPositions.map(p => p.roomId === roomId ? { ...p, width: newWidth } : p);
                            setRoomPositions(newPositions);
                            pushToHistory(newPositions);
                          }}
                          className="h-8"
                          disabled={position.locked}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Height</Label>
                        <Input
                          type="number"
                          value={position.height}
                          onChange={(e) => {
                            const newHeight = parseInt(e.target.value) || defaultRoomSize.height;
                            const newPositions = roomPositions.map(p => p.roomId === roomId ? { ...p, height: newHeight } : p);
                            setRoomPositions(newPositions);
                            pushToHistory(newPositions);
                          }}
                          className="h-8"
                          disabled={position.locked}
                        />
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => toggleRoomLock(roomId)}
                    >
                      {position.locked ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                      {position.locked ? 'Unlock' : 'Lock'}
                    </Button>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Add Room Dialog */}
      <Dialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Room to Floor Plan</DialogTitle>
            <DialogDescription>Select a room to place on the floor plan</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            <div className="space-y-2 p-1">
              {rooms.filter(r => !roomPositions.some(p => p.roomId === r.id)).map(room => (
                <div
                  key={room.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => addRoomToCanvas(room)}
                >
                  <div className={cn("w-4 h-4 rounded", getStatusInfo(room.status).color)} />
                  <div className="flex-1">
                    <div className="font-medium">{room.number}</div>
                    <div className="text-xs text-muted-foreground">{room.roomType.name}</div>
                  </div>
                  <Badge variant="outline">{getStatusInfo(room.status).label}</Badge>
                </div>
              ))}
              {rooms.filter(r => !roomPositions.some(p => p.roomId === r.id)).length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  All rooms have been placed
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
