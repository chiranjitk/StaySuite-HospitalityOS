'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import { 
  Bed, 
  Users, 
  Wrench, 
  Sparkles, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  CalendarClock,
  UserCheck,
  DoorOpen,
  Brush
} from 'lucide-react';

interface RoomStatus {
  available: number;
  occupied: number;
  maintenance: number;
  dirty: number;
  out_of_order: number;
}

interface Task {
  id: string;
  type: string;
  title: string;
  room: string | null;
  status: string;
  priority: string;
  scheduledAt: string | null;
  assignee: string | null;
}

interface CommandCenterData {
  rooms: RoomStatus;
  totalRooms: number;
  upcomingCheckIns: number;
  staffOnDuty: number;
  todaysTasks: Task[];
}

function RoomStatusCard({ 
  title, 
  count, 
  total, 
  icon: Icon, 
  color 
}: { 
  title: string; 
  count: number; 
  total: number; 
  icon: typeof Bed;
  color: string;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div className={cn("rounded-lg p-2", color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{title}</p>
          <span className="text-sm font-bold">{count}</span>
        </div>
        <div className="mt-1.5">
          <Progress value={percentage} className="h-1.5" />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{percentage}% of total</p>
      </div>
    </div>
  );
}

function TaskItem({ task }: { task: Task }) {
  const priorityConfig = {
    low: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
    medium: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
    urgent: { color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  };

  const statusConfig = {
    pending: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: Clock },
    in_progress: { color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400', icon: Loader2 },
    completed: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: CheckCircle2 },
  };

  const typeIcons: Record<string, typeof Sparkles> = {
    cleaning: Brush,
    maintenance: Wrench,
    inspection: CheckCircle2,
    other: Sparkles,
  };

  const TypeIcon = typeIcons[task.type] || Sparkles;
  const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.medium;
  const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
      <div className={cn("rounded-lg p-2 bg-muted", task.status === 'in_progress' && "animate-pulse")}>
        <TypeIcon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{task.title}</p>
          <Badge variant="secondary" className={cn("text-[10px] h-4 px-1", priority.color)}>
            {task.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {task.room && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              Room {task.room}
            </Badge>
          )}
          {task.assignee && (
            <span className="text-xs text-muted-foreground">{task.assignee}</span>
          )}
        </div>
      </div>
      <StatusIcon className={cn(
        "h-4 w-4",
        task.status === 'pending' && "text-muted-foreground",
        task.status === 'in_progress' && "text-cyan-600 dark:text-cyan-400 animate-spin",
        task.status === 'completed' && "text-emerald-600 dark:text-emerald-400"
      )} />
    </div>
  );
}

function CommandCenterSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-28 mb-1" />
          <Skeleton className="h-3 w-20" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24 mb-1" />
          <Skeleton className="h-3 w-20" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CommandCenter() {
  const [data, setData] = React.useState<CommandCenterData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        const result = await response.json();
        if (result.success) {
          setData(result.data.commandCenter);
        } else {
          setError(result.error?.message || 'Failed to load data');
        }
      } catch (err) {
        setError('Failed to fetch command center data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return <CommandCenterSkeleton />;
  }

  if (error || !data) {
    return (
      <Card className="border border-border/50 shadow-sm border-destructive/50">
        <CardContent className="p-6 flex items-center justify-center h-[400px] text-muted-foreground">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p className="text-sm">{error || 'Failed to load command center data'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Room Status Overview */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600">
                <Bed className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Room Status</CardTitle>
                <CardDescription className="text-xs">{data.totalRooms} total rooms</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <RoomStatusCard
            title="Available"
            count={data.rooms.available}
            total={data.totalRooms}
            icon={DoorOpen}
            color="bg-gradient-to-br from-emerald-500 to-teal-600"
          />
          <RoomStatusCard
            title="Occupied"
            count={data.rooms.occupied}
            total={data.totalRooms}
            icon={Bed}
            color="bg-gradient-to-br from-violet-500 to-purple-600"
          />
          <RoomStatusCard
            title="Dirty"
            count={data.rooms.dirty}
            total={data.totalRooms}
            icon={Brush}
            color="bg-gradient-to-br from-amber-500 to-orange-600"
          />
          <RoomStatusCard
            title="Maintenance"
            count={data.rooms.maintenance}
            total={data.totalRooms}
            icon={Wrench}
            color="bg-gradient-to-br from-pink-500 to-rose-600"
          />
          <RoomStatusCard
            title="Out of Order"
            count={data.rooms.out_of_order}
            total={data.totalRooms}
            icon={AlertTriangle}
            color="bg-gradient-to-br from-red-500 to-rose-600"
          />
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Operations Status</CardTitle>
              <CardDescription className="text-xs">Real-time metrics</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upcoming Check-ins */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="rounded-lg p-2 bg-gradient-to-br from-emerald-500 to-teal-600">
              <CalendarClock className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Upcoming Check-ins</p>
              <p className="text-xs text-muted-foreground">Next 3 hours</p>
            </div>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.upcomingCheckIns}</span>
          </div>

          {/* Staff on Duty */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="rounded-lg p-2 bg-gradient-to-br from-violet-500 to-purple-600">
              <UserCheck className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Staff on Duty</p>
              <p className="text-xs text-muted-foreground">Active employees</p>
            </div>
            <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">{data.staffOnDuty}</span>
          </div>

          {/* Pending Tasks */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="rounded-lg p-2 bg-gradient-to-br from-amber-500 to-orange-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Pending Tasks</p>
              <p className="text-xs text-muted-foreground">Requires attention</p>
            </div>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {data.todaysTasks.filter(t => t.status === 'pending').length}
            </span>
          </div>

          {/* In Progress Tasks */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="rounded-lg p-2 bg-gradient-to-br from-cyan-500 to-teal-600">
              <Loader2 className="h-4 w-4 text-white animate-spin" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">In Progress</p>
              <p className="text-xs text-muted-foreground">Being handled</p>
            </div>
            <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
              {data.todaysTasks.filter(t => t.status === 'in_progress').length}
            </span>
          </div>

          {/* Quick Actions */}
          <div className="pt-2">
            <Button variant="outline" className="w-full text-xs gap-1 h-8" onClick={() => useUIStore.getState().setActiveSection('dashboard-overview')}>
              View All Operations
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's Tasks */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Today's Tasks</CardTitle>
                <CardDescription className="text-xs">{data.todaysTasks.length} scheduled</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => useUIStore.getState().setActiveSection('housekeeping-tasks')}>
              View All
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {data.todaysTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
              <div className="rounded-full bg-muted p-3 mb-2">
                <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">All tasks completed</p>
              <p className="text-xs text-muted-foreground">No pending tasks for today</p>
            </div>
          ) : (
            <ScrollArea className="h-[320px] pr-3 -mr-3">
              <div className="space-y-2">
                {data.todaysTasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
