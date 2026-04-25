'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Brush,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MapPin,
  Calendar,
  User,
  GripVertical,
  AlertTriangle,
  Filter,
} from 'lucide-react';
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

interface TaskWithDrag extends Task {
  isDragging?: boolean;
}

const columns = [
  { id: 'pending', title: 'Pending', color: 'bg-gray-500', icon: Clock },
  { id: 'in_progress', title: 'In Progress', color: 'bg-amber-500', icon: AlertCircle },
  { id: 'completed', title: 'Completed', color: 'bg-emerald-500', icon: CheckCircle2 },
  { id: 'cancelled', title: 'Cancelled', color: 'bg-red-500', icon: XCircle },
];

const priorityColors = {
  low: 'border-gray-400',
  medium: 'border-amber-400',
  high: 'border-orange-400',
  urgent: 'border-red-400',
};

const priorityBgColors = {
  low: 'bg-gray-500/10',
  medium: 'bg-amber-500/10',
  high: 'bg-orange-500/10',
  urgent: 'bg-red-500/10',
};

export default function KanbanBoard() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch properties for filter
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          setProperties(result.data);
          setSelectedPropertyId(result.data[0].id);
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, []);

  // Fetch tasks with property filter
  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPropertyId) params.append('propertyId', selectedPropertyId);

      const response = await fetch(`/api/tasks?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setTasks(result.data);
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
  };

  useEffect(() => {
    if (selectedPropertyId) fetchTasks();
  }, [selectedPropertyId]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedTask || draggedTask.status === newStatus) {
      setDraggedTask(null);
      return;
    }

    const validTransitions: Record<string, string[]> = {
      pending: ['in_progress', 'completed'],
      in_progress: ['completed', 'pending'],
      completed: [],
      cancelled: ['pending'],
    };

    if (!validTransitions[draggedTask.status]?.includes(newStatus)) {
      toast({
        title: 'Invalid Transition',
        description: `Cannot move task from ${draggedTask.status.replace('_', ' ')} to ${newStatus.replace('_', ' ')}`,
        variant: 'destructive',
      });
      setDraggedTask(null);
      return;
    }

    // Optimistic update
    setTasks(prev => prev.map(t => 
      t.id === draggedTask.id ? { ...t, status: newStatus } : t
    ));

    try {
      const response = await fetch(`/api/tasks/${draggedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus,
          ...(newStatus === 'completed' && { completedAt: new Date().toISOString() }),
          ...(newStatus === 'in_progress' && { startedAt: new Date().toISOString() }),
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Task moved to ${newStatus.replace('_', ' ')}`,
        });
      } else {
        // Revert on error
        fetchTasks();
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update task status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating task:', error);
      fetchTasks();
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive',
      });
    } finally {
      setDraggedTask(null);
    }
  }, [draggedTask, toast]);

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
    setDragOverColumn(null);
  }, []);

  // Filter tasks by status filter
  const filteredTasks = statusFilter === 'all'
    ? tasks
    : statusFilter === 'high'
    ? tasks.filter(t => t.priority === 'high' || t.priority === 'urgent')
    : tasks.filter(t => t.priority === statusFilter);

  // Group tasks by status
  const tasksByStatus = columns.reduce((acc, column) => {
    acc[column.id] = filteredTasks.filter(task => task.status === column.id);
    return acc;
  }, {} as Record<string, Task[]>);

  // Task card component
  const TaskCard = ({ task }: { task: Task }) => (
    <Card
      draggable
      onDragStart={(e) => handleDragStart(e, task)}
      onDragEnd={handleDragEnd}
      onClick={() => { setSelectedTask(task); setIsDetailOpen(true); }}
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md border-l-4',
        priorityColors[task.priority as keyof typeof priorityColors],
        draggedTask?.id === task.id && 'opacity-50 scale-95',
        'hover:border-t-2 hover:border-t-primary/20'
      )}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{task.title}</p>
            {task.room && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin className="h-3 w-3" />
                <span>Room {task.room.number}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          </div>
        </div>

        {/* Priority & Type */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge 
            variant="secondary" 
            className={cn(
              'text-[10px] uppercase',
              priorityBgColors[task.priority as keyof typeof priorityBgColors]
            )}
          >
            {task.priority}
          </Badge>
          <Badge variant="outline" className="text-[10px] capitalize">
            {task.type}
          </Badge>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          {task.assignee ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-[8px]">
                  {task.assignee.firstName[0]}{task.assignee.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                {task.assignee.firstName}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>Unassigned</span>
            </div>
          )}
          {task.scheduledAt && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(task.scheduledAt), 'MMM d')}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Stats
  const totalTasks = tasks.length;
  const pendingTasks = tasksByStatus['pending']?.length || 0;
  const inProgressTasks = tasksByStatus['in_progress']?.length || 0;
  const completedTasks = tasksByStatus['completed']?.length || 0;

  // Reopen cancelled task
  const reopenTask = async (task: Task) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      });
      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Task reopened',
        });
        fetchTasks();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to reopen task',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error reopening task:', error);
      toast({
        title: 'Error',
        description: 'Failed to reopen task',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Brush className="h-5 w-5" />
            Task Board
          </h2>
          <p className="text-sm text-muted-foreground">
            Drag and drop tasks to update their status
          </p>
        </div>
        <div className="flex gap-2">
          {properties.length > 1 && (
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={fetchTasks}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-500/10">
              <Brush className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalTasks}</div>
              <div className="text-xs text-muted-foreground">Total Tasks</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-500/10">
              <Clock className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{pendingTasks}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{inProgressTasks}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{completedTasks}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant={statusFilter === 'all' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setStatusFilter('all')}>All ({tasks.length})</Badge>
        <Badge variant={statusFilter === 'high' ? 'destructive' : 'outline'} className="cursor-pointer" onClick={() => setStatusFilter('high')}>High Priority</Badge>
        <Badge variant={statusFilter === 'medium' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setStatusFilter('medium')}>Medium</Badge>
        <Badge variant={statusFilter === 'low' ? 'secondary' : 'outline'} className="cursor-pointer" onClick={() => setStatusFilter('low')}>Low</Badge>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {columns.map((column) => (
            <div
              key={column.id}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
              className={cn(
                'rounded-lg border-2 border-dashed transition-colors min-h-[500px]',
                dragOverColumn === column.id 
                  ? 'border-primary bg-primary/5' 
                  : 'border-transparent',
                column.id === 'cancelled' && 'opacity-70'
              )}
            >
              {/* Column Header */}
              <div className={cn(
                'flex items-center gap-2 p-3 rounded-t-lg',
                column.color,
                'text-white'
              )}>
                <column.icon className="h-4 w-4" />
                <h3 className="font-medium">{column.title}</h3>
                <Badge variant="secondary" className="ml-auto bg-white/20 text-white">
                  {tasksByStatus[column.id]?.length || 0}
                </Badge>
              </div>

              {/* Column Content */}
              <ScrollArea className="h-[450px] p-2">
                <div className="space-y-2">
                  {tasksByStatus[column.id]?.map((task) => (
                    column.id === 'cancelled' ? (
                      <Card key={task.id} className="opacity-75">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{task.title}</p>
                              {task.room && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>Room {task.room.number}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className={cn('text-[10px] uppercase', priorityBgColors[task.priority as keyof typeof priorityBgColors])}>
                              {task.priority}
                            </Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs mt-2"
                            onClick={(e) => { e.stopPropagation(); reopenTask(task); }}
                          >
                            Reopen
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <TaskCard key={task.id} task={task} />
                    )
                  ))}
                  {(!tasksByStatus[column.id] || tasksByStatus[column.id].length === 0) && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <column.icon className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">No tasks</p>
                      <p className="text-xs">Drag tasks here</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
      )}

      {/* Task Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-lg">{selectedTask.title}</h3>
                {selectedTask.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTask.description}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Badge variant="outline" className="capitalize mt-1">
                    {selectedTask.type}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <Badge variant="secondary" className="capitalize mt-1">
                    {selectedTask.category}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Priority</p>
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      'mt-1 capitalize',
                      priorityBgColors[selectedTask.priority as keyof typeof priorityBgColors]
                    )}
                  >
                    {selectedTask.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="secondary" className="mt-1 capitalize">
                    {selectedTask.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {selectedTask.room && (
                <div>
                  <p className="text-xs text-muted-foreground">Room</p>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Room {selectedTask.room.number} - {selectedTask.room.roomType?.name}
                    </span>
                  </div>
                </div>
              )}

              {selectedTask.assignee && (
                <div>
                  <p className="text-xs text-muted-foreground">Assigned To</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-xs">
                        {selectedTask.assignee.firstName[0]}{selectedTask.assignee.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {selectedTask.assignee.firstName} {selectedTask.assignee.lastName}
                    </span>
                  </div>
                </div>
              )}

              {selectedTask.scheduledAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Scheduled</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {format(new Date(selectedTask.scheduledAt), 'PPP p')}
                    </span>
                  </div>
                </div>
              )}

              {selectedTask.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    {selectedTask.notes}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-2 border-t">
                Created {formatDistanceToNow(new Date(selectedTask.createdAt))} ago
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
