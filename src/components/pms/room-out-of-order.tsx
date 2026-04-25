'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wrench,
  Plus,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Search,
  Building2,
  Calendar,
  DollarSign,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface Room {
  id: string;
  number: string;
  name: string | null;
  floor: number;
  status: string;
  propertyId: string;
}

interface MaintenanceBlock {
  id: string;
  roomId: string;
  roomNumber: string;
  reason: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  blockedBy: string | null;
  status: string;
  priority: string;
  estimatedCost: number | null;
  actualCost: number | null;
  notes: string | null;
  createdAt: string;
  room: {
    id: string;
    number: string;
    name: string | null;
    floor: number;
    status: string;
    roomType?: { id: string; name: string } | null;
  };
}

const REASONS = [
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'bg-amber-500' },
  { value: 'renovation', label: 'Renovation', icon: Building2, color: 'bg-purple-500' },
  { value: 'deep_cleaning', label: 'Deep Cleaning', icon: Shield, color: 'bg-cyan-500' },
  { value: 'inspection', label: 'Inspection', icon: Search, color: 'bg-blue-500' },
  { value: 'quarantine', label: 'Quarantine', icon: AlertTriangle, color: 'bg-red-500' },
];

const PRIORITIES: Record<string, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'bg-gray-500' },
  high: { label: 'High', color: 'bg-amber-500' },
  urgent: { label: 'Urgent', color: 'bg-red-500' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: 'bg-blue-500' },
  active: { label: 'Active', color: 'bg-amber-500' },
  completed: { label: 'Completed', color: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500' },
};

export default function RoomOutOfOrder() {
  const { toast } = useToast();

  const [blocks, setBlocks] = useState<MaintenanceBlock[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBlock, setSelectedBlock] = useState<MaintenanceBlock | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Create form
  const [roomId, setRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
  const [priority, setPriority] = useState('normal');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [completeActualCost, setCompleteActualCost] = useState('');

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms?limit=500');
      const json = await res.json();
      if (json.success) {
        setRooms(json.data.filter((r: Room) => r.status !== 'maintenance'));
      }
    } catch { /* ignore */ }
  }, []);

  const fetchBlocks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await fetch(`/api/rooms/maintenance-blocks?${params.toString()}`);
      const json = await res.json();
      if (json.success) setBlocks(json.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch blocks', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);
  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  const handleCreate = async () => {
    if (!roomId || !reason || !startDate) {
      toast({ title: 'Error', description: 'Fill all required fields', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/rooms/maintenance-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          reason,
          description: description || undefined,
          startDate,
          endDate: endDate || undefined,
          priority,
          estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: `Room ${json.data.roomNumber} blocked` });
        setShowCreateDialog(false);
        resetForm();
        fetchBlocks();
        fetchRooms();
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create block', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedBlock) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/rooms/maintenance-blocks/${selectedBlock.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualCost: completeActualCost ? parseFloat(completeActualCost) : null }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: 'Block completed' });
        setShowCompleteDialog(false);
        setSelectedBlock(null);
        fetchBlocks();
        fetchRooms();
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedBlock) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/rooms/maintenance-blocks/${selectedBlock.id}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: 'Block cancelled' });
        setShowCancelDialog(false);
        setSelectedBlock(null);
        fetchBlocks();
        fetchRooms();
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setRoomId('');
    setReason('');
    setDescription('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
    setPriority('normal');
    setEstimatedCost('');
  };

  // Calendar data
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const startDayOfWeek = monthStart.getDay(); // 0=Sun
    const paddedDays = [
      ...Array(startDayOfWeek).fill(null),
      ...eachDayOfInterval({ start: monthStart, end: monthEnd })
    ];
    return paddedDays;
  }, [calendarMonth]);

  const getBlocksForDay = (day: Date) => {
    return blocks.filter(b => {
      const start = parseISO(b.startDate);
      const end = b.endDate ? parseISO(b.endDate) : null;
      if (end) {
        return (day >= start && day <= end) && (b.status === 'active' || b.status === 'scheduled');
      }
      return isSameDay(day, start) && (b.status === 'active' || b.status === 'scheduled');
    });
  };

  // Stats
  const activeBlocks = blocks.filter(b => b.status === 'active');
  const scheduledBlocks = blocks.filter(b => b.status === 'scheduled');
  const totalBlockedRooms = new Set(activeBlocks.map(b => b.roomId)).size;
  const totalEstCost = blocks.filter(b => b.status !== 'cancelled' && b.status !== 'completed').reduce((s, b) => s + (b.estimatedCost || 0), 0);

  // Blocks by reason
  const blocksByReason = blocks.filter(b => b.status !== 'cancelled' && b.status !== 'completed').reduce((acc, b) => {
    acc[b.reason] = (acc[b.reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const prevMonth = () => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  const nextMonth = () => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Room Out-of-Order
          </h2>
          <p className="text-sm text-muted-foreground">Manage rooms blocked for maintenance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchBlocks(); fetchRooms(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { setShowCreateDialog(true); resetForm(); }}>
            <Plus className="h-4 w-4 mr-2" />
            Block Room
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Wrench className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-red-400 bg-clip-text text-transparent">{totalBlockedRooms}</div>
              <div className="text-xs text-muted-foreground">Blocked Rooms</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">{scheduledBlocks.length}</div>
              <div className="text-xs text-muted-foreground">Scheduled</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">
                {blocks.filter(b => b.status === 'completed').length}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <DollarSign className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-violet-400 bg-clip-text text-transparent">
                ${totalEstCost.toFixed(0)}
              </div>
              <div className="text-xs text-muted-foreground">Est. Cost</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Blocks by Reason */}
      {Object.keys(blocksByReason).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-3">Active Blocks by Reason</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(blocksByReason).map(([reason, count]) => {
                const reasonCfg = REASONS.find(r => r.value === reason);
                return (
                  <Badge key={reason} className={cn("text-white text-xs", reasonCfg?.color)}>
                    {reasonCfg?.label || reason}: {count}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Blocks Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between gap-2">
            <CardTitle className="text-base">Active Blocks</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : blocks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No maintenance blocks</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {blocks.map((block) => {
                      const statusCfg = STATUS_CONFIG[block.status] || STATUS_CONFIG.scheduled;
                      const priorityCfg = PRIORITIES[block.priority] || PRIORITIES.normal;
                      const reasonCfg = REASONS.find(r => r.value === block.reason);
                      return (
                        <motion.tr
                          key={block.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-muted/50 border-b"
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">Room {block.roomNumber}</p>
                              {block.room?.roomType && (
                                <p className="text-xs text-muted-foreground">{block.room.roomType.name} - Floor {block.room.floor}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-xs", reasonCfg?.color && `border-current text-current`)}>
                              {reasonCfg?.label || block.reason}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-white text-xs", priorityCfg.color)}>
                              {priorityCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <p>{format(new Date(block.startDate), 'MMM d, yyyy')}</p>
                            {block.endDate && <p className="text-muted-foreground">{format(new Date(block.endDate), 'MMM d, yyyy')}</p>}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {block.estimatedCost ? `$${block.estimatedCost.toFixed(2)}` : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-white text-xs", statusCfg.color)}>
                              {statusCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {(block.status === 'active' || block.status === 'scheduled') && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs"
                                    onClick={() => { setSelectedBlock(block); setShowCompleteDialog(true); setCompleteActualCost(''); }}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Complete
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs text-red-600"
                                    onClick={() => { setSelectedBlock(block); setShowCancelDialog(true); }}
                                  >
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Cancel
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Calendar View */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendar View
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
                <span className="text-lg">&lt;</span>
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center">
                {format(calendarMonth, 'MMMM yyyy')}
              </span>
              <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
                <span className="text-lg">&gt;</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">{day}</div>
            ))}
            {calendarDays.map((day, idx) => {
              if (!day) {
                return (
                  <div key={`empty-${idx}`} className="min-h-[60px] border rounded p-1 text-xs bg-muted/20" />
                );
              }
              const dayBlocks = getBlocksForDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[60px] border rounded p-1 text-xs",
                    isToday && "border-primary bg-primary/5"
                  )}
                >
                  <div className={cn("font-medium mb-0.5", isToday && "text-primary")}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayBlocks.slice(0, 2).map(b => (
                      <div
                        key={b.id}
                        className={cn(
                          "text-[10px] px-1 rounded truncate text-white",
                          b.status === 'active' ? "bg-amber-500" : "bg-blue-500"
                        )}
                      >
                        R{b.roomNumber}
                      </div>
                    ))}
                    {dayBlocks.length > 2 && (
                      <div className="text-[10px] text-muted-foreground">+{dayBlocks.length - 2} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create Block Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowCreateDialog(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Block Room</DialogTitle>
            <DialogDescription>Take a room out of service for maintenance</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Room *</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      Room {r.number} {r.name ? `- ${r.name}` : ''} (Floor {r.floor})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Describe the issue or work needed..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estimated Cost (optional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowCreateDialog(false); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving || !roomId || !reason || !startDate}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Block Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Block</DialogTitle>
            <DialogDescription>
              Mark <span className="font-bold">Room {selectedBlock?.roomNumber}</span> as available
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Actual Cost (optional)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={completeActualCost}
              onChange={(e) => setCompleteActualCost(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The room will be set back to available status.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>Cancel</Button>
            <Button onClick={handleComplete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Block</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the maintenance block for <span className="font-bold">Room {selectedBlock?.roomNumber}</span>?
              The room will be set back to available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCancelDialog(false); setSelectedBlock(null); }}>Keep</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
