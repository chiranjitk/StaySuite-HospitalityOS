'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Wrench,
  Plus,
  Search,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar,
  RefreshCw,
  MapPin,
  User,
  MoreHorizontal,
  Pencil,
  Trash2,
  Play,
  Settings,
  Repeat,
  AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, addDays } from 'date-fns';

interface Room {
  id: string;
  number: string;
  floor: number;
  roomType: {
    id: string;
    name: string;
  };
}

interface Task {
  id: string;
  type: string;
  category: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  room: Room | null;
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  } | null;
}

interface Property {
  id: string;
  name: string;
}

const maintenanceCategories = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'structural', label: 'Structural' },
  { value: 'other', label: 'Other' },
];

const taskPriorities = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
];

const taskStatuses = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-500', icon: Clock },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-500', icon: Play },
  { value: 'completed', label: 'Completed', color: 'bg-emerald-500', icon: CheckCircle2 },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500', icon: AlertTriangle },
];

// Preventive maintenance interface
interface PreventiveMaintenance {
  id: string;
  title: string;
  description: string | null;
  frequency: string;
  nextDueAt: string | null;
  lastCompletedAt: string | null;
  status: string;
  assetId?: string | null;
}

export default function Maintenance() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [preventiveItems, setPreventiveItems] = useState<PreventiveMaintenance[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assetMap, setAssetMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('requests');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isPmCreateOpen, setIsPmCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');

  // Preventive maintenance form state
  const [pmFormData, setPmFormData] = useState({
    propertyId: '',
    title: '',
    description: '',
    assetId: '',
    frequency: 'monthly',
    priority: 'medium',
    estimatedDuration: '',
    checklistItems: ['', '', ''],
  });
  const [assetList, setAssetList] = useState<Array<{ id: string; name: string }>>([]);

  // Form state
  const [formData, setFormData] = useState({
    propertyId: '',
    roomId: '',
    assignedTo: '',
    title: '',
    description: '',
    category: 'other',
    priority: 'medium',
    scheduledAt: '',
    notes: '',
  });

  // Fetch properties and preventive maintenance
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [propertiesRes, preventiveRes] = await Promise.all([
          fetch('/api/properties'),
          fetch('/api/preventive-maintenance'),
        ]);
        
        const propertiesResult = await propertiesRes.json();
        if (propertiesResult.success) {
          setProperties(propertiesResult.data);
        }
        
        const preventiveResult = await preventiveRes.json();
        if (preventiveResult.success) {
          setPreventiveItems(preventiveResult.data);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch assets for name lookup and PM form dropdown
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const response = await fetch('/api/assets');
        const result = await response.json();
        if (result.success) {
          const map: Record<string, string> = {};
          const list: Array<{ id: string; name: string }> = [];
          for (const asset of result.data) {
            if (asset.id && asset.name) {
              map[asset.id] = asset.name;
              list.push({ id: asset.id, name: asset.name });
            }
          }
          setAssetMap(map);
          setAssetList(list);
        }
      } catch (error) {
        console.error('Error fetching assets:', error);
      }
    };
    fetchAssets();
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

  // Fetch maintenance tasks
  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('type', 'maintenance');
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);

      const response = await fetch(`/api/tasks?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setTasks(result.data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch maintenance requests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter, priorityFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchTasks();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Create maintenance request
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
          type: 'maintenance',
          scheduledAt: formData.scheduledAt || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Maintenance request created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchTasks();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create request',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating request:', error);
      toast({
        title: 'Error',
        description: 'Failed to create maintenance request',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update task status
  const updateTaskStatus = async (taskId: string, newStatus: string, notes?: string) => {
    try {
      const body: Record<string, string> = { status: newStatus };
      if (notes) body.notes = notes;

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Request status updated`,
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

  // Open edit dialog
  const openEditDialog = (task: Task) => {
    setSelectedTask(task);
    setFormData({
      propertyId: task.room?.roomType ? (properties[0]?.id || '') : '',
      roomId: task.room?.id || '',
      assignedTo: task.assignee?.id || '',
      title: task.title,
      description: task.description || '',
      category: task.category || 'other',
      priority: task.priority,
      scheduledAt: task.scheduledAt ? format(new Date(task.scheduledAt), "yyyy-MM-dd'T'HH:mm") : '',
      notes: task.notes || '',
    });
    setIsEditOpen(true);
  };

  // Handle edit
  const handleEdit = async () => {
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
          type: 'maintenance',
          scheduledAt: formData.scheduledAt || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Maintenance request updated successfully',
        });
        setIsEditOpen(false);
        setSelectedTask(null);
        resetForm();
        fetchTasks();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update request',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating request:', error);
      toast({
        title: 'Error',
        description: 'Failed to update maintenance request',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete/cancel
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
          description: 'Maintenance request cancelled',
        });
        setIsDeleteOpen(false);
        setSelectedTask(null);
        fetchTasks();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to cancel request',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel request',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle complete with notes
  const handleCompleteWithNotes = async () => {
    if (!selectedTask) return;
    setIsSaving(true);
    await updateTaskStatus(selectedTask.id, 'completed', completionNotes);
    setIsCompleteOpen(false);
    setCompletionNotes('');
    setSelectedTask(null);
    setIsSaving(false);
  };

  const resetForm = () => {
    setFormData({
      propertyId: properties[0]?.id || '',
      roomId: '',
      assignedTo: '',
      title: '',
      description: '',
      category: 'other',
      priority: 'medium',
      scheduledAt: '',
      notes: '',
    });
  };

  const resetPmForm = () => {
    setPmFormData({
      propertyId: properties[0]?.id || '',
      title: '',
      description: '',
      assetId: '',
      frequency: 'monthly',
      priority: 'medium',
      estimatedDuration: '',
      checklistItems: ['', '', ''],
    });
  };

  const handlePmCreate = async () => {
    if (!pmFormData.propertyId || !pmFormData.title) {
      toast({
        title: 'Validation Error',
        description: 'Property and title are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const checklist = pmFormData.checklistItems
        .filter(item => item.trim() !== '')
        .map((item, index) => ({ id: String(index + 1), name: item, completed: false }));

      const response = await fetch('/api/preventive-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: pmFormData.propertyId,
          title: pmFormData.title,
          description: pmFormData.description || null,
          assetId: pmFormData.assetId || null,
          frequency: pmFormData.frequency,
          checklist: JSON.stringify(checklist),
          status: 'active',
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Preventive maintenance schedule created successfully',
        });
        setIsPmCreateOpen(false);
        resetPmForm();
        // Refresh preventive items
        const preventiveRes = await fetch('/api/preventive-maintenance');
        const preventiveResult = await preventiveRes.json();
        if (preventiveResult.success) {
          setPreventiveItems(preventiveResult.data);
        }
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create schedule',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating PM schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to create preventive maintenance schedule',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
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
      <Badge variant="outline" className={cn('text-white', option?.color)}>
        {option?.label || priority}
      </Badge>
    );
  };

  const getFrequencyBadge = (frequency: string) => {
    const colors: Record<string, string> = {
      daily: 'bg-gray-500',
      weekly: 'bg-emerald-500',
      monthly: 'bg-amber-500',
      quarterly: 'bg-violet-500',
      yearly: 'bg-cyan-500',
    };
    return (
      <Badge variant="secondary" className={cn('text-white capitalize', colors[frequency] || 'bg-gray-500')}>
        {frequency}
      </Badge>
    );
  };

  // Stats
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const urgentCount = tasks.filter(t => t.priority === 'urgent').length;

  // Preventive stats
  const upcomingCount = preventiveItems.filter(p => {
    if (!p.nextDueAt) return false;
    const dueDate = new Date(p.nextDueAt);
    const today = new Date();
    return dueDate <= addDays(today, 7);
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Maintenance Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Track maintenance requests and preventive maintenance schedules
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTasks}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
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
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{urgentCount}</div>
              <div className="text-xs text-muted-foreground">Urgent</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Calendar className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{upcomingCount}</div>
              <div className="text-xs text-muted-foreground">Due This Week</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requests">Maintenance Requests</TabsTrigger>
          <TabsTrigger value="preventive">Preventive Maintenance</TabsTrigger>
        </TabsList>

        {/* Maintenance Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search requests..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-11 sm:h-auto"
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

          {/* Requests Table */}
          <Card>
            <CardContent className="p-3 sm:p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Wrench className="h-12 w-12 mb-4" />
                  <p>No maintenance requests found</p>
                  <p className="text-sm">Create a new request to get started</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block">
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Request</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Assigned To</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tasks.map((task) => (
                            <TableRow key={task.id}>
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
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-sm">Room {task.room.number}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">General</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {task.category}
                                </Badge>
                              </TableCell>
                              <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                              <TableCell>
                                {task.assignee ? (
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-xs">
                                        {task.assignee.firstName[0]}{task.assignee.lastName[0]}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm">{task.assignee.firstName}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">Unassigned</span>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(task.status)}</TableCell>
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
                                        Start Work
                                      </DropdownMenuItem>
                                    )}
                                    {task.status === 'in_progress' && (
                                      <DropdownMenuItem onClick={() => { setSelectedTask(task); setCompletionNotes(task.notes || ''); setIsCompleteOpen(true); }}>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Mark Complete
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => openEditDialog(task)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Edit Request
                                    </DropdownMenuItem>
                                    {['pending', 'in_progress'].includes(task.status) && (
                                      <DropdownMenuItem
                                        onClick={() => { setSelectedTask(task); setIsDeleteOpen(true); }}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Cancel Request
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>

                  {/* Mobile Card Layout */}
                  <div className="md:hidden">
                    <ScrollArea className="h-[calc(100vh-420px)] min-h-[400px]">
                      <div className="space-y-3">
                        {tasks.map((task) => (
                          <Card key={task.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-3 space-y-3">
                              {/* Row 1: Title + Status + Priority */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{task.title}</p>
                                  {task.description && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                                {getStatusBadge(task.status)}
                              </div>

                              {/* Row 2: Badges row */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="capitalize">{task.category}</Badge>
                                {getPriorityBadge(task.priority)}
                              </div>

                              {/* Row 3: Location + Assignee */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-muted/50 rounded-lg px-2 py-1.5">
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span>Location</span>
                                  </div>
                                  <p className="text-xs font-semibold mt-0.5">
                                    {task.room ? `Room ${task.room.number}` : 'General'}
                                  </p>
                                </div>
                                <div className="bg-muted/50 rounded-lg px-2 py-1.5">
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <User className="h-3 w-3" />
                                    <span>Assigned</span>
                                  </div>
                                  <p className="text-xs font-semibold mt-0.5 truncate">
                                    {task.assignee ? task.assignee.firstName : 'Unassigned'}
                                  </p>
                                </div>
                              </div>

                              {/* Row 4: Action buttons */}
                              <div className="flex gap-2">
                                {task.status === 'pending' && (
                                  <Button
                                    variant="outline"
                                    className="flex-1 h-11"
                                    onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                  >
                                    <Play className="h-3.5 w-3.5 mr-1.5" />
                                    Start
                                  </Button>
                                )}
                                {task.status === 'in_progress' && (
                                  <Button
                                    variant="outline"
                                    className="flex-1 h-11"
                                    onClick={() => { setSelectedTask(task); setCompletionNotes(task.notes || ''); setIsCompleteOpen(true); }}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                    Complete
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  className="flex-1 h-11"
                                  onClick={() => openEditDialog(task)}
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                  Edit
                                </Button>
                                {['pending', 'in_progress'].includes(task.status) && (
                                  <Button
                                    variant="outline"
                                    className="h-11 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => { setSelectedTask(task); setIsDeleteOpen(true); }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preventive Maintenance Tab */}
        <TabsContent value="preventive" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetPmForm(); setIsPmCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          </div>
          <Card>
            <CardHeader className="p-3 sm:p-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Preventive Maintenance Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              {/* Desktop Table */}
              <div className="hidden md:block">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Last Completed</TableHead>
                      <TableHead>Next Due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preventiveItems.map((item) => {
                      const isOverdue = item.nextDueAt && new Date(item.nextDueAt) < new Date();
                      const isUpcoming = item.nextDueAt && 
                        new Date(item.nextDueAt) <= addDays(new Date(), 7) && 
                        !isOverdue;
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{item.title}</p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{item.assetId ? (assetMap[item.assetId] || `Asset #${item.assetId.slice(0, 8)}`) : 'General'}</span>
                          </TableCell>
                          <TableCell>{getFrequencyBadge(item.frequency)}</TableCell>
                          <TableCell>
                            {item.lastCompletedAt ? (
                              <span className="text-sm">
                                {formatDistanceToNow(new Date(item.lastCompletedAt))} ago
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.nextDueAt ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span className={cn(
                                  'text-sm',
                                  isOverdue && 'text-red-500 font-medium',
                                  isUpcoming && 'text-amber-500'
                                )}>
                                  {format(new Date(item.nextDueAt), 'MMM d, yyyy')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Not scheduled</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isOverdue ? (
                              <Badge variant="destructive">Overdue</Badge>
                            ) : isUpcoming ? (
                              <Badge variant="secondary" className="bg-amber-500 text-white">Due Soon</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-emerald-500 text-white">On Track</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              </div>
              {/* Mobile Card Layout for Preventive Maintenance */}
              <div className="md:hidden">
                <ScrollArea className="h-[calc(100vh-420px)] min-h-[400px]">
                  <div className="space-y-3">
                    {preventiveItems.map((item) => {
                      const isOverdue = item.nextDueAt && new Date(item.nextDueAt) < new Date();
                      const isUpcoming = item.nextDueAt && 
                        new Date(item.nextDueAt) <= addDays(new Date(), 7) && 
                        !isOverdue;
                      return (
                        <Card key={item.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-3 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{item.title}</p>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
                                )}
                              </div>
                              {isOverdue ? (
                                <Badge variant="destructive">Overdue</Badge>
                              ) : isUpcoming ? (
                                <Badge variant="secondary" className="bg-amber-500 text-white">Due Soon</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-emerald-500 text-white">On Track</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {getFrequencyBadge(item.frequency)}
                              {item.assetId && (
                                <Badge variant="outline" className="text-[10px]">
                                  {assetMap[item.assetId] || `Asset #${item.assetId.slice(0, 8)}`}
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-muted/50 rounded-lg px-2 py-1.5">
                                <div className="text-[10px] text-muted-foreground">Last Completed</div>
                                <p className="text-xs font-semibold mt-0.5">
                                  {item.lastCompletedAt ? formatDistanceToNow(new Date(item.lastCompletedAt)) + ' ago' : 'Never'}
                                </p>
                              </div>
                              <div className="bg-muted/50 rounded-lg px-2 py-1.5">
                                <div className="text-[10px] text-muted-foreground">Next Due</div>
                                <p className={cn('text-xs font-semibold mt-0.5', isOverdue && 'text-red-500', isUpcoming && 'text-amber-500')}>
                                  {item.nextDueAt ? format(new Date(item.nextDueAt), 'MMM d, yyyy') : 'Not scheduled'}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Maintenance Request</DialogTitle>
            <DialogDescription>
              Update maintenance request details
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
            <div className="space-y-2">
              <Label htmlFor="edit-roomId">Room (Optional)</Label>
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
                      Room {room.number} - {room.roomType?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                placeholder="Brief description of the issue"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Detailed description of the maintenance issue..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    {maintenanceCategories.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-scheduledAt">Scheduled Date</Label>
              <Input
                id="edit-scheduledAt"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduledAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Additional Notes</Label>
              <Textarea
                id="edit-notes"
                placeholder="Any additional information..."
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
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete/Cancel Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Maintenance Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this maintenance request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedTask && (
              <div className="rounded-lg bg-muted p-4">
                <p className="font-medium">{selectedTask.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedTask.room ? `Room ${selectedTask.room.number}` : 'General'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Keep Request
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete with Notes Dialog */}
      <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Maintenance Request</DialogTitle>
            <DialogDescription>
              Add completion notes (optional) before marking this request as complete.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedTask && (
              <div className="rounded-lg bg-muted p-3 mb-4">
                <p className="font-medium text-sm">{selectedTask.title}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="completion-notes">Completion Notes</Label>
              <Textarea
                id="completion-notes"
                placeholder="What was done to resolve this issue..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCompleteOpen(false); setCompletionNotes(''); }}>
              Cancel
            </Button>
            <Button onClick={handleCompleteWithNotes} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preventive Maintenance Create Dialog */}
      <Dialog open={isPmCreateOpen} onOpenChange={setIsPmCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Preventive Maintenance Schedule</DialogTitle>
            <DialogDescription>
              Set up a recurring maintenance schedule for an asset or general area.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="pm-propertyId">Property *</Label>
              <Select
                value={pmFormData.propertyId}
                onValueChange={(value) => setPmFormData(prev => ({ ...prev, propertyId: value }))}
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
              <Label htmlFor="pm-title">Schedule Title *</Label>
              <Input
                id="pm-title"
                placeholder="e.g., HVAC Filter Replacement"
                value={pmFormData.title}
                onChange={(e) => setPmFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pm-description">Description</Label>
              <Textarea
                id="pm-description"
                placeholder="Describe the maintenance task..."
                value={pmFormData.description}
                onChange={(e) => setPmFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pm-asset">Asset (Optional)</Label>
              <Select
                value={pmFormData.assetId}
                onValueChange={(value) => setPmFormData(prev => ({ ...prev, assetId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select asset" />
                </SelectTrigger>
                <SelectContent>
                  {assetList.map(asset => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pm-frequency">Frequency *</Label>
                <Select
                  value={pmFormData.frequency}
                  onValueChange={(value) => setPmFormData(prev => ({ ...prev, frequency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pm-priority">Priority</Label>
                <Select
                  value={pmFormData.priority}
                  onValueChange={(value) => setPmFormData(prev => ({ ...prev, priority: value }))}
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="pm-duration">Estimated Duration</Label>
              <Input
                id="pm-duration"
                placeholder="e.g., 2 hours, 30 minutes"
                value={pmFormData.estimatedDuration}
                onChange={(e) => setPmFormData(prev => ({ ...prev, estimatedDuration: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Checklist Items</Label>
              <div className="space-y-2">
                {pmFormData.checklistItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Checklist item ${index + 1}`}
                      value={item}
                      onChange={(e) => {
                        const updated = [...pmFormData.checklistItems];
                        updated[index] = e.target.value;
                        setPmFormData(prev => ({ ...prev, checklistItems: updated }));
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (pmFormData.checklistItems.length <= 1) return;
                        setPmFormData(prev => ({
                          ...prev,
                          checklistItems: prev.checklistItems.filter((_, i) => i !== index),
                        }));
                      }}
                      disabled={pmFormData.checklistItems.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPmFormData(prev => ({
                      ...prev,
                      checklistItems: [...prev.checklistItems, ''],
                    }));
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Item
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPmCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePmCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Maintenance Request</DialogTitle>
            <DialogDescription>
              Create a new maintenance request
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
            <div className="space-y-2">
              <Label htmlFor="roomId">Room (Optional)</Label>
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
                      Room {room.number} - {room.roomType?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Brief description of the issue"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Detailed description of the maintenance issue..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                    {maintenanceCategories.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledAt">Scheduled Date</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduledAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information..."
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
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
