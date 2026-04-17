'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Download,
  Calendar,
  Users,
  Star,
  Clock,
  CheckCircle,
  TrendingUp,
  Award,
  Target,
} from 'lucide-react';
import { exportToCSV } from '@/lib/export-utils';

interface StaffPerformance {
  totalStaff: number;
  activeToday: number;
  avgRating: number;
  tasksCompleted: number;
  avgResponseTime: number;
  staffList: {
    id: string;
    name: string;
    role: string;
    department: string;
    rating: number;
    tasksCompleted: number;
    tasksInProgress: number;
    avgCompletionTime: number;
    attendance: number;
    performance: number;
  }[];
  departmentStats: {
    department: string;
    staff: number;
    tasksCompleted: number;
    avgRating: number;
    efficiency: number;
  }[];
  weeklyTrend: {
    day: string;
    completed: number;
    pending: number;
    inProgress: number;
  }[];
}

const chartConfig = {
  completed: {
    label: 'Completed',
    color: '#10b981',
  },
  inProgress: {
    label: 'In Progress',
    color: '#f59e0b',
  },
  pending: {
    label: 'Pending',
    color: '#ec4899',
  },
  efficiency: {
    label: 'Efficiency',
    color: '#8b5cf6',
  },
} satisfies ChartConfig;

const chartColors = ['#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

function formatTime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getPerformanceColor(performance: number): string {
  if (performance >= 90) return 'text-emerald-600';
  if (performance >= 75) return 'text-amber-600';
  if (performance >= 60) return 'text-orange-600';
  return 'text-red-600';
}

export default function StaffPerformance() {
  const [data, setData] = useState<StaffPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('7');
  const [department, setDepartment] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/staff/performance?days=${dateRange}&department=${department}`);
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError('Failed to load staff performance data');
        }
      } catch (err) {
        console.error('Failed to fetch staff performance:', err);
        setError('Failed to load staff performance data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [dateRange, department]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => {
            // Toggle dateRange to a different value and back to force re-fetch
            const current = dateRange;
            setDateRange('');
            setTimeout(() => setDateRange(current), 0);
          }}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Staff Performance</h2>
          <p className="text-muted-foreground">Monitor team productivity and performance metrics</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="Housekeeping">Housekeeping</SelectItem>
              <SelectItem value="Front Desk">Front Desk</SelectItem>
              <SelectItem value="Maintenance">Maintenance</SelectItem>
              <SelectItem value="F&B">F&B</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => {
            if (data?.staffList) {
              exportToCSV(
                data.staffList.map(s => ({
                  name: s.name,
                  role: s.role,
                  department: s.department,
                  rating: s.rating,
                  tasksCompleted: s.tasksCompleted,
                  tasksInProgress: s.tasksInProgress,
                  avgCompletionTime: s.avgCompletionTime,
                  attendance: s.attendance,
                  performance: s.performance,
                })),
                `staff-performance-${dateRange}d`,
                [
                  { key: 'name', label: 'Name' },
                  { key: 'role', label: 'Role' },
                  { key: 'department', label: 'Department' },
                  { key: 'rating', label: 'Rating' },
                  { key: 'tasksCompleted', label: 'Tasks Completed' },
                  { key: 'tasksInProgress', label: 'Tasks In Progress' },
                  { key: 'avgCompletionTime', label: 'Avg Completion Time (min)' },
                  { key: 'attendance', label: 'Attendance (%)' },
                  { key: 'performance', label: 'Performance (%)' },
                ]
              );
            }
          }}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Staff</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{data.totalStaff}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  {data.activeToday} active today
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <Users className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Avg Rating</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 flex items-center gap-1">
                  {data.avgRating.toFixed(1)}
                  <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Guest satisfaction
                </p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <Star className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Tasks Completed</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{data.tasksCompleted}</p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                  This period
                </p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <CheckCircle className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Avg Response</p>
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{formatTime(data.avgResponseTime)}</p>
                <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                  Time to complete
                </p>
              </div>
              <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                <Clock className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Weekly Task Trend</CardTitle>
          <CardDescription>Task completion over the past week</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={data.weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
              <XAxis dataKey="day" className="text-xs" tickLine={false} axisLine={false} />
              <YAxis className="text-xs" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="inProgress" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pending" stackId="a" fill="#ec4899" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Department Stats and Staff List */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Department Performance */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-lg">Department Performance</CardTitle>
            </div>
            <CardDescription>Efficiency by department</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.departmentStats.length > 0 ? data.departmentStats.map((dept, index) => (
              <div key={dept.department} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: chartColors[index % chartColors.length] }}
                    />
                    <span className="font-medium">{dept.department}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{dept.staff} staff</span>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                      {dept.efficiency}% efficiency
                    </Badge>
                  </div>
                </div>
                <Progress value={dept.efficiency} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{dept.tasksCompleted} tasks</span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" /> {dept.avgRating.toFixed(1)}
                  </span>
                </div>
              </div>
            )) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No department data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">Top Performers</CardTitle>
            </div>
            <CardDescription>Highest performing staff members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.staffList
                .sort((a, b) => b.performance - a.performance)
                .slice(0, 5)
                .map((staff, index) => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 font-bold text-xs">
                        {index + 1}
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-xs">
                          {staff.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{staff.name}</p>
                        <p className="text-xs text-muted-foreground">{staff.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${getPerformanceColor(staff.performance)}`}>
                        {staff.performance}%
                      </p>
                      <p className="text-xs text-muted-foreground">{staff.tasksCompleted} tasks</p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff List Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">All Staff Performance</CardTitle>
          <CardDescription>Detailed performance metrics by team member</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.staffList.map((staff) => (
              <div
                key={staff.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                      {staff.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{staff.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{staff.role}</span>
                      <span>•</span>
                      <Badge variant="outline" className="text-xs">{staff.department}</Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Rating */}
                  <div className="text-center">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                      <span className="font-medium">{staff.rating.toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Rating</p>
                  </div>

                  {/* Tasks */}
                  <div className="text-center">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                        {staff.tasksCompleted}
                      </Badge>
                      {staff.tasksInProgress > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                          {staff.tasksInProgress}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Tasks</p>
                  </div>

                  {/* Completion Time */}
                  <div className="text-center">
                    <p className="font-medium">{formatTime(staff.avgCompletionTime)}</p>
                    <p className="text-xs text-muted-foreground">Avg Time</p>
                  </div>

                  {/* Attendance */}
                  <div className="text-center">
                    <p className="font-medium">{staff.attendance}%</p>
                    <p className="text-xs text-muted-foreground">Attendance</p>
                  </div>

                  {/* Performance Score */}
                  <div className="text-center min-w-[60px]">
                    <p className={`text-lg font-bold ${getPerformanceColor(staff.performance)}`}>
                      {staff.performance}%
                    </p>
                    <Progress
                      value={staff.performance}
                      className="h-1.5 w-16"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
