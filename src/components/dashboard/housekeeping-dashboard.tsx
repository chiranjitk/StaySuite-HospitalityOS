'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Bed, 
  Sparkles, 
  Wrench, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface HousekeepingStats {
  roomsToClean: number;
  roomsInProgress: number;
  roomsInspected: number;
  maintenanceRequests: number;
  taskBreakdown: {
    checkout: number;
    stayover: number;
    touchup: number;
  };
  recentTasks: Array<{
    id: string;
    roomNumber: string;
    type: string;
    status: string;
    assignedTo: string;
    priority: string;
  }>;
}

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="border border-border/50 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskItem({ task }: { task: HousekeepingStats['recentTasks'][0] }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400',
  };

  const priorityColors: Record<string, string> = {
    high: 'text-red-600 dark:text-red-400',
    medium: 'text-amber-600 dark:text-amber-400',
    low: 'text-green-600 dark:text-green-400',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/40">
          <Bed className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <p className="font-medium">Room {task.roomNumber}</p>
          <p className="text-xs text-muted-foreground">{task.type} • {task.assignedTo}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge className={statusColors[task.status] || statusColors.pending} variant="secondary">
          {task.status.replace('_', ' ')}
        </Badge>
        <span className={cn("text-xs font-medium", priorityColors[task.priority])}>
          {task.priority}
        </span>
      </div>
    </div>
  );
}

const EMPTY_HOUSEKEEPING_STATS: HousekeepingStats = {
  roomsToClean: 0,
  roomsInProgress: 0,
  roomsInspected: 0,
  maintenanceRequests: 0,
  taskBreakdown: {
    checkout: 0,
    stayover: 0,
    touchup: 0,
  },
  recentTasks: []
};

export default function HousekeepingDashboard() {
  const [stats, setStats] = React.useState<HousekeepingStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/housekeeping/dashboard');
        const result = await response.json();
        if (result.success) {
          setStats(result.data);
        } else {
          setError(result.error?.message || 'Failed to load dashboard');
          setStats(EMPTY_HOUSEKEEPING_STATS);
        }
      } catch (err) {
        setError('Failed to fetch housekeeping data');
        setStats(EMPTY_HOUSEKEEPING_STATS);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border border-border/50 shadow-sm">
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Housekeeping Dashboard</h1>
        <p className="text-muted-foreground">
          Manage room cleaning tasks and maintenance requests
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Rooms to Clean"
          value={stats.roomsToClean}
          icon={Bed}
          color="bg-gradient-to-br from-teal-500 to-cyan-600"
        />
        <StatCard
          title="In Progress"
          value={stats.roomsInProgress}
          icon={RefreshCw}
          color="bg-gradient-to-br from-amber-500 to-orange-600"
        />
        <StatCard
          title="Inspected"
          value={stats.roomsInspected}
          icon={CheckCircle2}
          color="bg-gradient-to-br from-green-500 to-emerald-600"
        />
        <StatCard
          title="Maintenance"
          value={stats.maintenanceRequests}
          subtitle="requests"
          icon={Wrench}
          color="bg-gradient-to-br from-red-500 to-rose-600"
        />
      </div>

      {/* Task Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              Today's Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-sm font-medium">Checkout Cleans</span>
              </div>
              <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400">
                {stats.taskBreakdown.checkout}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-sm font-medium">Stayover Cleans</span>
              </div>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400">
                {stats.taskBreakdown.stayover}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium">Touch-ups</span>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400">
                {stats.taskBreakdown.touchup}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              Recent Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.recentTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/?section=housekeeping-tasks')}
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              View All Tasks
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/?section=housekeeping-status')}
            >
              <Bed className="mr-2 h-4 w-4" />
              Room Status
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/?section=housekeeping-maintenance')}
            >
              <Wrench className="mr-2 h-4 w-4" />
              Maintenance
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
