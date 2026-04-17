'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
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
  Maximize2,
  Download,
  DoorOpen,
  Building2,
  User,
  Bed,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface FloorPlanData {
  id: string;
  name: string;
  width: number;
  height: number;
  gridSize: number;
  imageUrl?: string;
  floor: number;
  property?: {
    id: string;
    name: string;
  };
}

interface FloorPlanViewerProps {
  floorPlan: FloorPlanData;
  rooms: Room[];
  positions: RoomPosition[];
  onRoomClick?: (room: Room) => void;
  showStats?: boolean;
  className?: string;
}

const roomStatuses = [
  { value: 'available', label: 'Available', color: 'bg-emerald-500', borderColor: 'border-emerald-500', textColor: 'text-emerald-600' },
  { value: 'occupied', label: 'Occupied', color: 'bg-blue-500', borderColor: 'border-blue-500', textColor: 'text-blue-600' },
  { value: 'dirty', label: 'Dirty', color: 'bg-yellow-500', borderColor: 'border-yellow-500', textColor: 'text-yellow-600' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-500', borderColor: 'border-orange-500', textColor: 'text-orange-600' },
  { value: 'out_of_order', label: 'Out of Order', color: 'bg-red-500', borderColor: 'border-red-500', textColor: 'text-red-600' },
];

export function FloorPlanViewer({
  floorPlan,
  rooms,
  positions,
  onRoomClick,
  showStats = true,
  className,
}: FloorPlanViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  
  const viewerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

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
    return positions.find(p => p.roomId === roomId);
  };

  // Handle canvas pan
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target === canvasRef.current || target.classList.contains('canvas-bg') || target.tagName === 'svg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Auto-fit on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!viewerRef.current) return;
      
      const viewerRect = viewerRef.current.getBoundingClientRect();
      const scaleX = (viewerRect.width - 40) / floorPlan.width;
      const scaleY = (viewerRect.height - 40) / floorPlan.height;
      const newZoom = Math.min(scaleX, scaleY, 1);
      
      setZoom(newZoom);
      setPan({ x: 0, y: 0 });
    }, 100);
    return () => clearTimeout(timer);
  }, [floorPlan]);

  // Export as image
  const handleExport = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = floorPlan.width * 2;
    canvas.height = floorPlan.height * 2;
    ctx.scale(2, 2);
    
    // Draw background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, floorPlan.width, floorPlan.height);
    
    // Draw grid
    const gridSize = floorPlan.gridSize || 20;
    ctx.strokeStyle = '#e5e7eb';
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
    positions.forEach(position => {
      const room = getRoomById(position.roomId);
      if (!room) return;
      
      const statusInfo = getStatusInfo(room.status);
      
      ctx.fillStyle = statusInfo.color.includes('emerald') ? '#d1fae5' :
                      statusInfo.color.includes('blue') ? '#dbeafe' :
                      statusInfo.color.includes('yellow') ? '#fef3c7' :
                      statusInfo.color.includes('orange') ? '#ffedd5' : '#fee2e2';
      ctx.strokeStyle = statusInfo.color.includes('emerald') ? '#10b981' :
                        statusInfo.color.includes('blue') ? '#3b82f6' :
                        statusInfo.color.includes('yellow') ? '#eab308' :
                        statusInfo.color.includes('orange') ? '#f97316' : '#ef4444';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.roundRect(position.x, position.y, position.width, position.height, 8);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(room.number, position.x + position.width / 2, position.y + position.height / 2 + 4);
    });
    
    const link = document.createElement('a');
    link.download = `${floorPlan.name.replace(/\s+/g, '_')}_floorplan.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Calculate stats
  const stats = (() => {
    const roomCounts = {
      total: positions.length,
      available: 0,
      occupied: 0,
      dirty: 0,
      maintenance: 0,
      out_of_order: 0,
    };
    
    positions.forEach(position => {
      const room = getRoomById(position.roomId);
      if (room) {
        const status = room.status as keyof typeof roomCounts;
        if (status in roomCounts) {
          roomCounts[status]++;
        }
      }
    });
    
    return roomCounts;
  })();

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">{floorPlan.name}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Floor {floorPlan.floor}</span>
              {floorPlan.property && (
                <>
                  <span>•</span>
                  <span>{floorPlan.property.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Stats */}
        {showStats && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span className="text-xs">{stats.available}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-xs">{stats.occupied}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-500" />
              <span className="text-xs">{stats.dirty}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span className="text-xs">{stats.maintenance}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-xs">{stats.out_of_order}</span>
            </div>
          </div>
        )}
      </div>

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
        
        <div className="flex-1" />
        
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div
          ref={viewerRef}
          className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-900 relative"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
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
                    id="grid-viewer"
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
                <rect width="100%" height="100%" fill="url(#grid-viewer)" />
              </svg>
            )}

            {/* Border */}
            <div className="absolute inset-0 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg" />

            {/* Room Blocks */}
            {positions.map((position) => {
              const room = getRoomById(position.roomId);
              if (!room) return null;

              const statusInfo = getStatusInfo(room.status);
              const isHovered = hoveredRoom === position.roomId;

              return (
                <TooltipProvider key={position.roomId}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "absolute rounded-lg border-2 flex flex-col items-center justify-center transition-all",
                          statusInfo.borderColor,
                          isHovered && "shadow-lg scale-105",
                          onRoomClick && "cursor-pointer hover:shadow-md"
                        )}
                        style={{
                          left: position.x,
                          top: position.y,
                          width: position.width,
                          height: position.height,
                          backgroundColor: statusInfo.color.includes('emerald') ? '#d1fae5' :
                                          statusInfo.color.includes('blue') ? '#dbeafe' :
                                          statusInfo.color.includes('yellow') ? '#fef3c7' :
                                          statusInfo.color.includes('orange') ? '#ffedd5' : '#fee2e2',
                        }}
                        onMouseEnter={() => setHoveredRoom(position.roomId)}
                        onMouseLeave={() => setHoveredRoom(null)}
                        onClick={() => onRoomClick?.(room)}
                      >
                        <div className={cn("w-2 h-2 rounded-full mb-0.5", statusInfo.color)} />
                        <span className="font-bold text-xs">{room.number}</span>
                        <span className="text-[10px] text-muted-foreground">{room.roomType.code}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="w-48">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">Room {room.number}</div>
                          <Badge variant="outline" className={cn("text-xs", statusInfo.textColor)}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            <Bed className="h-3 w-3" />
                            <span>{room.roomType.name}</span>
                          </div>
                          {room.name && (
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3" />
                              <span>{room.name}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3" />
                            <span>Floor {room.floor}</span>
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}

            {/* Empty State */}
            {positions.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <DoorOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No rooms on this floor</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Room List Sidebar */}
        <div className="w-56 border-l bg-muted/30 flex flex-col">
          <div className="p-3 border-b bg-background">
            <h3 className="font-semibold text-sm">Room List</h3>
            <p className="text-xs text-muted-foreground mt-1">{positions.length} rooms</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {positions.map((position) => {
                const room = getRoomById(position.roomId);
                if (!room) return null;
                
                const statusInfo = getStatusInfo(room.status);
                const isHovered = hoveredRoom === position.roomId;
                
                return (
                  <div
                    key={position.roomId}
                    className={cn(
                      "p-2 rounded border cursor-pointer hover:bg-muted/50 transition-colors",
                      isHovered && "border-primary bg-primary/10"
                    )}
                    onMouseEnter={() => setHoveredRoom(position.roomId)}
                    onMouseLeave={() => setHoveredRoom(null)}
                    onClick={() => onRoomClick?.(room)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded", statusInfo.color)} />
                      <span className="font-medium text-sm">{room.number}</span>
                      <Badge variant="outline" className="text-xs">{room.roomType.code}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{statusInfo.label}</div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Zoom Slider */}
      <div className="flex items-center gap-4 p-2 border-t bg-background">
        <Move className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Pan: Click & drag canvas</span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">Zoom:</span>
        <Slider
          value={[zoom * 100]}
          min={25}
          max={200}
          step={5}
          className="w-32"
          onValueChange={(v) => setZoom(v[0] / 100)}
        />
      </div>
    </div>
  );
}
