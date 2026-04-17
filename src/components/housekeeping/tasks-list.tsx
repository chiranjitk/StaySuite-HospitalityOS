'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Brush,
  Plus,
  Search,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  MapPin,
  RefreshCw,
  MoreHorizontal,
  Pencil,
  Trash2,
  Play,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface Room {
  id: string;
  number: string;
  floor: number;
  status: string;
  roomType: {
    id: string;
    name: string;
  };
}

interface Assignee {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  jobTitle: string | null;
}

interface Task {
  id: string;
  propertyId: string;
  type: string;
  category: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  estimatedDuration: number | null;
  notes: string | null;
  createdAt: string;
  room: Room | null;
  assignee: Assignee | null;
}

interface Property {
  id: string;
  name: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  department: string | null;
  jobTitle: string | null;
}

const taskTypes = [
  { value: 'cleaning', label: 'Cleaning', color: 'bg-emerald-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-amber-500' },
  { value: 'inspection', label: 'Inspection', color: 'bg-violet-500' },
  { value: 'other', label: 'Other', color: 'bg-gray-500' },
];

const taskCategories = [
  { value: 'routine', label: 'Routine' },
  { value: 'deep_clean', label: 'Deep Clean' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'emergency', label: 'Emergency' },
];

const taskPriorities = [
  { value: 'low', label: 'Low', color: 'bg-gradient-to-r from-emerald-500 to-green-500' },
  { value: 'medium', label: 'Medium', color: 'bg-gradient-to-r from-amber-400 to-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-gradient-to-r from-orange-500 to-amber-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-gradient-to-r from-red-500 to-rose-500' },
];

const taskStatuses = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-500', icon: Clock },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-500', icon: Play },
  { value: 'completed', label: 'Completed', color: 'bg-emerald-500', icon: CheckCircle2 },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500', icon: XCircle },
];

export default function TasksList() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [summary, setSummary] = useState({
    byStatus: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
  });

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    propertyId: '',
    roomId: '',
    assignedTo: '',
    type: 'cleaning',
    category: 'routine',
    title: '',
    description: '',
    priority: 'medium',
    scheduledAt: '',
    estimatedDuration: '',
    notes: '',
  });

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [propertiesRes, usersRes] = await Promise.all([
          fetch('/api/properties'),
          fetch('/api/users?role=housekeeping'),
        ]);
        
        const propertiesResult = await propertiesRes.json();
        if (propertiesResult.success) {
          setProperties(propertiesResult.data);
        }
        
        const usersResult = await usersRes.json();
        if (usersResult.success) {
          setUsers(usersResult.data);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch rooms when property changes
  useEffect(() => {
    const fetchRooms = async () => {
      if (!formData.propertyId) {
        setRooms([]);
        return;
      }
      try {
        const response = await fetch(`/api/rooms?propertyId=${formData.propertyId}`);
        const result = await response.json();
        if (result.success) {
          setRooms(result.data);
        }
      } catch (error) {
        console.error('Error fetching rooms:', error);
      }
    };
    fetchRooms();
  }, [formData.propertyId]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);

      const response = await fetch(`/api/tasks?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setTasks(result.data);
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch tasks',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, typeFilter, priorityFilter, toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchTasks();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchTasks]);

  // Create task
  const handleCreate = async () => {
    if (!formData.propertyId || !formData.title) {
      toast({
        title: 'Validation Error',
        description: 'Property and title are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          estimatedDuration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : null,
          scheduledAt: formData.scheduledAt || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Task created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchTasks();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create task',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to create task',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update task
  const handleUpdate = async () => {
    if (!selectedTask || !formData.title) {
      toast({
        title: 'Validation Error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          estimatedDuration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : null,
          scheduledAt: formData.scheduledAt || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Task updated successfully',
        });
        setIsEditOpen(false);
        setSelectedTask(null);
        resetForm();
        fetchTasks();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update task',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete task
  const handleDelete = async () => {
    if (!selectedTask) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Task cancelled successfully',
        });
        setIsDeleteOpen(false);
        setSelectedTask(null);
        fetchTasks();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to cancel task',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel task',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update task status
  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Task status updated to ${newStatus.replace('_', ' ')}`,
        });
        fetchTasks();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      propertyId: properties[0]?.id || '',
      roomId: '',
      assignedTo: '',
      type: 'cleaning',
      category: 'routine',
      title: '',
      description: '',
      priority: 'medium',
      scheduledAt: '',
      estimatedDuration: '',
      notes: '',
    });
  };

  const openEditDialog = (task: Task) => {
    setSelectedTask(task);
    setFormData({
      propertyId: task.propertyId || '',
      roomId: task.room?.id || '',
      assignedTo: task.assignee?.id || '',
      type: task.type,
      category: task.category,
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      scheduledAt: task.scheduledAt ? format(new Date(task.scheduledAt), "yyyy-MM-dd'T'HH:mm") : '',
      estimatedDuration: task.estimatedDuration?.toString() || '',
      notes: task.notes || '',
    });
    setIsEditOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const option = taskStatuses.find(o => o.value === status);
    const Icon = option?.icon || Clock;
    return (
      <Badge variant="secondary" className={cn('text-white gap-1', option?.color)}>
        <Icon className="h-3 w-3" />
        {option?.label || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const option = taskPriorities.find(o => o.value === priority);
    return (
      <Badge className={cn('text-white border-0 shadow-sm', option?.color)}>
        {option?.label || priority}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const option = taskTypes.find(o => o.value === type);
    return (
      <Badge variant="secondary" className={cn('text-white', option?.color)}>
        {option?.label || type}
      </Badge>
    );
  };

  // Stats
  const pendingCount = summary.byStatus['pending'] || 0;
  const inProgressCount = summary.byStatus['in_progress'] || 0;
  const completedCount = summary.byStatus['completed'] || 0;
  const urgentCount = summary.byPriority['urgent'] || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Brush className="h-5 w-5" />
            Housekeeping Tasks
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage and track housekeeping tasks across your property
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTasks}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-500/10">
              <Clock className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Play className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{inProgressCount}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{completedCount}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-red-500 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10 animate-pulse">
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{urgentCount}</div>
              <div className="text-xs text-muted-foreground">Urgent</div>
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
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {taskStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {taskTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {taskPriorities.map(priority => (
                  <SelectItem key={priority.value} value={priority.value}>
                    {priority.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Brush className="h-12 w-12 mb-4" />
              <p>No tasks found</p>
              <p className="text-sm">Create a new task to get started</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const isUrgent = task.priority === 'urgent';
                    const isOverdue = task.scheduledAt && new Date(task.scheduledAt) < new Date() && task.status !== 'completed' && task.status !== 'cancelled';
                    const progress = task.status === 'completed' ? 100 : task.status === 'in_progress' ? (task.estimatedDuration && task.startedAt ? Math.min(95, Math.round(((Date.now() - new Date(task.startedAt).getTime()) / (task.estimatedDuration * 60000)) * 100)) : task.startedAt ? Math.min(95, Math.round((Date.now() - new Date(task.startedAt).getTime()) / 3600000)) : 0) : 0;
                    
                    return (
                    <TableRow key={task.id} className={cn(
                      "transition-all duration-150 border-l-2 border-l-transparent hover:border-l-primary hover:bg-muted/40",
                      isUrgent && "border-l-red-500 hover:border-l-red-400 bg-red-50/30 dark:bg-red-950/20"
                    )}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.room ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Room {task.room.number}</p>
                              <p className="text-xs text-muted-foreground">
                                {task.room.roomType?.name} • Floor {task.room.floor}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No room</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-xs">
                                {task.assignee.firstName[0]}{task.assignee.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {task.assignee.firstName} {task.assignee.lastName}
                              </p>
                              {task.assignee.jobTitle && (
                                <p className="text-xs text-muted-foreground">
                                  {task.assignee.jobTitle}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>{getTypeBadge(task.type)}</TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}
                        {isOverdue && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                            </span>
                            <span className="text-[10px] text-red-500 font-medium">Overdue</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.scheduledAt ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <div>
                              <p className="text-sm">
                                {format(new Date(task.scheduledAt), 'MMM d, yyyy')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(task.scheduledAt), 'h:mm a')}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not scheduled</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.status === 'in_progress' ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground">{progress}%</span>
                            </div>
                          </div>
                        ) : (
                          getStatusBadge(task.status)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {task.status === 'pending' && (
                              <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'in_progress')}>
                                <Play className="h-4 w-4 mr-2" />
                                Start Task
                              </DropdownMenuItem>
                            )}
                            {task.status === 'in_progress' && (
                              <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'completed')}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Complete Task
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openEditDialog(task)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Task
                            </DropdownMenuItem>
                            {['pending', 'in_progress'].includes(task.status) && (
                              <DropdownMenuItem 
                                onClick={() => { setSelectedTask(task); setIsDeleteOpen(true); }}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Cancel Task
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new housekeeping task to the system
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property *</Label>
              <Select
                value={formData.propertyId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, propertyId: value, roomId: '' }))}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roomId">Room</Label>
                <Select
                  value={formData.roomId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, roomId: value }))}
                  disabled={!formData.propertyId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.length === 0 ? (
                      <SelectItem value="_none" disabled>No rooms available</SelectItem>
                    ) : (
                      rooms.map(room => (
                        <SelectItem key={room.id} value={room.id}>
                          Room {room.number} - {room.roomType?.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assign To</Label>
                <Select
                  value={formData.assignedTo}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, assignedTo: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.length === 0 ? (
                      <SelectItem value="_none" disabled>No housekeeping staff available</SelectItem>
                    ) : (
                      users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}{user.jobTitle ? ` - ${user.jobTitle}` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Task title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Task details..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskCategories.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskPriorities.map(priority => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedDuration">Est. Duration (min)</Label>
                <Input
                  id="estimatedDuration"
                  type="number"
                  placeholder="30"
                  value={formData.estimatedDuration}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimatedDuration: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledAt">Scheduled At</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduledAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update task details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="edit-propertyId">Property</Label>
              <Select
                value={formData.propertyId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, propertyId: value, roomId: '' }))}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-roomId">Room</Label>
                <Select
                  value={formData.roomId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, roomId: value }))}
                  disabled={!formData.propertyId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map(room => (
                      <SelectItem key={room.id} value={room.id}>
                        Room {room.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-assignedTo">Assign To</Label>
                <Select
                  value={formData.assignedTo}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, assignedTo: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.length === 0 ? (
                      <SelectItem value="_none" disabled>No housekeeping staff available</SelectItem>
                    ) : (
                      users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}{user.jobTitle ? ` - ${user.jobTitle}` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                placeholder="Task title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Task details..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskCategories.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskPriorities.map(priority => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-estimatedDuration">Est. Duration (min)</Label>
                <Input
                  id="edit-estimatedDuration"
                  type="number"
                  placeholder="30"
                  value={formData.estimatedDuration}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimatedDuration: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-scheduledAt">Scheduled At</Label>
              <Input
                id="edit-scheduledAt"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduledAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedTask && (
              <div className="rounded-lg bg-muted p-4">
                <p className="font-medium">{selectedTask.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedTask.room ? `Room ${selectedTask.room.number}` : 'No room assigned'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Keep Task
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
