'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Clock,
  Wrench,
  Zap,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Timer,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const CRON_SECRET = process.env.NEXT_PUBLIC_CRON_SECRET || '';

interface AutomationStats {
  recurringTasks: number;
  pmOverdue: number;
  checkoutTasksToday: number;
  autoAssigned: number;
}

interface CronResult {
  success: boolean;
  message: string;
  error?: string;
  data?: {
    created?: number;
    overdue?: number;
    dryRun?: boolean;
  };
}

export default function HousekeepingAutomation() {
  const [stats, setStats] = useState<AutomationStats>({
    recurringTasks: 0,
    pmOverdue: 0,
    checkoutTasksToday: 0,
    autoAssigned: 0,
  });
  const [loading, setLoading] = useState(true);
  const [triggeringRecurring, setTriggeringRecurring] = useState(false);
  const [triggeringPM, setTriggeringPM] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<'recurring' | 'pm' | null>(null);
  const [cronResults, setCronResults] = useState<CronResult | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/housekeeping/dashboard');
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          setStats({
            recurringTasks: data.data.stats?.recurringPending ?? 0,
            pmOverdue: data.data.stats?.pmOverdue ?? 0,
            checkoutTasksToday: data.data.stats?.checkoutTasks ?? 0,
            autoAssigned: data.data.stats?.autoAssigned ?? 0,
          });
        }
      }
    } catch {
      // Dashboard might not expose all automation stats, use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const triggerRecurringTasks = async (dryRun = false) => {
    setTriggeringRecurring(true);
    try {
      const res = await fetch('/api/cron/recurring-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CRON_SECRET}`,
        },
        body: JSON.stringify({ dryRun }),
      });
      const result: CronResult = await res.json();
      setCronResults(result);

      if (result.success) {
        toast.success(result.message || `Recurring task check complete`);
        fetchStats();
      } else {
        toast.error(result.error || 'Failed to trigger recurring tasks');
      }
    } catch {
      toast.error('Network error triggering recurring tasks');
    } finally {
      setTriggeringRecurring(false);
      setConfirmDialog(null);
    }
  };

  const triggerPMAutoCheck = async (dryRun = false) => {
    setTriggeringPM(true);
    try {
      const res = await fetch('/api/cron/pm-autotrigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CRON_SECRET}`,
        },
        body: JSON.stringify({ dryRun }),
      });
      const result: CronResult = await res.json();
      setCronResults(result);

      if (result.success) {
        toast.success(result.message || 'PM auto-check complete');
        fetchStats();
      } else {
        toast.error(result.error || 'Failed to trigger PM auto-check');
      }
    } catch {
      toast.error('Network error triggering PM auto-check');
    } finally {
      setTriggeringPM(false);
      setConfirmDialog(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Housekeeping Automation</h1>
        <p className="text-muted-foreground">
          Manage automated task generation, preventive maintenance triggers, and checkout workflows.
        </p>
      </div>

      {!CRON_SECRET && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">
          Cron is not configured. Set <code className="rounded bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5">NEXT_PUBLIC_CRON_SECRET</code> in your environment to enable automated task triggers.
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                <RotateCcw className="h-5 w-5 text-teal-700 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recurring Tasks</p>
                <p className="text-2xl font-bold">{stats.recurringTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Wrench className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">PM Overdue</p>
                <p className="text-2xl font-bold">{stats.pmOverdue}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Calendar className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Checkout Tasks Today</p>
                <p className="text-2xl font-bold">{stats.checkoutTasksToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Zap className="h-5 w-5 text-purple-700 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Auto-Assigned</p>
                <p className="text-2xl font-bold">{stats.autoAssigned}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Automation Rules */}
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Automation Rules</TabsTrigger>
          <TabsTrigger value="triggers">Manual Triggers</TabsTrigger>
          <TabsTrigger value="workflow">Checkout Workflow</TabsTrigger>
        </TabsList>

        {/* Automation Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Checkout -> Dirty Rule */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-900/30">
                      <ArrowRight className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    </div>
                    <CardTitle className="text-base">Checkout to Dirty</CardTitle>
                  </div>
                  <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">Active</Badge>
                </div>
                <CardDescription>Automatic room status update on guest checkout</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Trigger: Booking status changes to <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">checked_out</code>
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Action: Set room status to <Badge variant="outline" className="text-xs mx-0.5">dirty</Badge> and housekeeping to <Badge variant="outline" className="text-xs mx-0.5">dirty</Badge>
                  </span>
                </div>
                <Separator />
                <div className="flex items-start gap-2 text-sm">
                  <Zap className="h-4 w-4 mt-0.5 text-amber-500 dark:text-amber-400" />
                  <span className="font-medium">Auto-creates high-priority checkout cleaning task (45 min estimate)</span>
                </div>
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                  <p>Full cleaning checklist automatically included:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>Strip and replace all linens</li>
                    <li>Clean and sanitize bathroom</li>
                    <li>Dust all surfaces</li>
                    <li>Vacuum/sweep/mop floors</li>
                    <li>Restock amenities and supplies</li>
                    <li>Check for damages</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Recurring Task Rule */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-100 dark:bg-blue-900/30">
                      <RotateCcw className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    </div>
                    <CardTitle className="text-base">Recurring Task Generation</CardTitle>
                  </div>
                  <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">Active</Badge>
                </div>
                <CardDescription>Auto-create task instances from completed recurring tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <Timer className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Trigger: Cron job or manual trigger
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400" />
                  <span>
                    Checks completed recurring tasks and creates new instances based on frequency
                  </span>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Supported Frequencies:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Daily (1 day)</Badge>
                    <Badge variant="outline">Weekly (7 days)</Badge>
                    <Badge variant="outline">Monthly (30 days)</Badge>
                    <Badge variant="outline">Quarterly (90 days)</Badge>
                    <Badge variant="outline">Yearly (365 days)</Badge>
                  </div>
                </div>
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  <p>New tasks inherit: property, room, assignee, type, category, priority, duration, and recurrence rule from the parent task.</p>
                </div>
              </CardContent>
            </Card>

            {/* PM Auto-Trigger Rule */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-amber-100 dark:bg-amber-900/30">
                      <Wrench className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                    </div>
                    <CardTitle className="text-base">PM Auto-Trigger</CardTitle>
                  </div>
                  <Badge variant="default" className="bg-amber-600 hover:bg-amber-700">Active</Badge>
                </div>
                <CardDescription>Auto-create maintenance tasks for overdue preventive maintenance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Trigger: PM item <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">nextDueAt</code> is past due
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span>
                    Creates <Badge variant="outline" className="text-xs mx-0.5">maintenance</Badge> / <Badge variant="outline" className="text-xs mx-0.5">preventive</Badge> task with PM checklist
                  </span>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Duplicate Prevention:</p>
                  <p className="text-xs text-muted-foreground">
                    Checks for existing active tasks with the same title within the last 7 days before creating a new one.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Auto-advances PM due date:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Daily +1d</Badge>
                    <Badge variant="outline">Weekly +7d</Badge>
                    <Badge variant="outline">Monthly +30d</Badge>
                    <Badge variant="outline">Quarterly +90d</Badge>
                    <Badge variant="outline">Yearly +365d</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Room Status Workflow */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-purple-100 dark:bg-purple-900/30">
                      <RefreshCw className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                    </div>
                    <CardTitle className="text-base">Room Status Workflow</CardTitle>
                  </div>
                  <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">Active</Badge>
                </div>
                <CardDescription>Automated room status transitions through the cleaning lifecycle</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="border-red-300 text-red-700 dark:text-red-300">Dirty</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="border-yellow-300 text-yellow-700 dark:text-yellow-300">Cleaning</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-300">Inspected</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="border-green-300 text-green-700 dark:text-green-300">Clean/Available</Badge>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 dark:text-red-400 font-medium min-w-[80px]">Dirty:</span>
                    <span className="text-muted-foreground">Room needs cleaning (auto-set on checkout)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-600 dark:text-yellow-400 font-medium min-w-[80px]">Cleaning:</span>
                    <span className="text-muted-foreground">Staff is actively cleaning the room</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[80px]">Inspected:</span>
                    <span className="text-muted-foreground">Cleaning done, awaiting supervisor inspection</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400 font-medium min-w-[80px]">Clean:</span>
                    <span className="text-muted-foreground">Room passed inspection, available for new guests</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Manual Triggers Tab */}
        <TabsContent value="triggers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manual Cron Triggers</CardTitle>
              <CardDescription>
                Manually trigger automation jobs. These are normally run on a schedule by an external cron service.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-3 p-4 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-medium">Recurring Task Generator</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Scans completed recurring tasks and creates new instances based on their frequency rules.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => triggerRecurringTasks(true)}
                      disabled={triggeringRecurring}
                    >
                      {triggeringRecurring ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Timer className="mr-1 h-3 w-3" />
                      )}
                      Dry Run
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setConfirmDialog('recurring')}
                      disabled={triggeringRecurring}
                    >
                      {triggeringRecurring ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="mr-1 h-3 w-3" />
                      )}
                      Execute
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 p-4 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="font-medium">PM Auto-Trigger</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Checks overdue preventive maintenance items and creates maintenance tasks automatically.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => triggerPMAutoCheck(true)}
                      disabled={triggeringPM}
                    >
                      {triggeringPM ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Timer className="mr-1 h-3 w-3" />
                      )}
                      Dry Run
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setConfirmDialog('pm')}
                      disabled={triggeringPM}
                    >
                      {triggeringPM ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="mr-1 h-3 w-3" />
                      )}
                      Execute
                    </Button>
                  </div>
                </div>
              </div>

              {/* Last Result */}
              {cronResults && (
                <div className="mt-4">
                  <Separator className="mb-4" />
                  <h4 className="text-sm font-medium mb-2">Last Execution Result</h4>
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      {cronResults.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                      <span className="font-medium">{cronResults.message}</span>
                    </div>
                    {cronResults.data && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {cronResults.data.created !== undefined && (
                          <p>Tasks created: {cronResults.data.created}</p>
                        )}
                        {cronResults.data.overdue !== undefined && (
                          <p>Overdue PM items: {cronResults.data.overdue}</p>
                        )}
                        {cronResults.data.dryRun && (
                          <Badge variant="secondary" className="text-xs">Dry Run</Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cron Setup Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cron Configuration</CardTitle>
              <CardDescription>
                Set up an external cron scheduler to automate these jobs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted p-4 space-y-3 text-sm font-mono">
                <div>
                  <p className="text-muted-foreground font-sans text-xs mb-1">Recurring Tasks (hourly):</p>
                  <code className="text-xs">0 * * * * curl -X POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/cron/recurring-tasks -H &quot;Authorization: Bearer YOUR_CRON_SECRET&quot; -H &quot;Content-Type: application/json&quot; -d &apos;{}&apos;</code>
                </div>
                <div>
                  <p className="text-muted-foreground font-sans text-xs mb-1">PM Auto-Trigger (every 6 hours):</p>
                  <code className="text-xs">0 */6 * * * curl -X POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/cron/pm-autotrigger -H &quot;Authorization: Bearer YOUR_CRON_SECRET&quot; -H &quot;Content-Type: application/json&quot; -d &apos;{}&apos;</code>
                </div>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-400">Security Note</p>
                    <p className="text-amber-700 dark:text-amber-500 text-xs mt-0.5">
                      Set the <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">CRON_SECRET</code> environment variable to protect cron endpoints from unauthorized access.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checkout Workflow Tab */}
        <TabsContent value="workflow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checkout to Available Workflow</CardTitle>
              <CardDescription>
                The complete automated journey from guest checkout to room ready for next guest.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-700 dark:text-red-400 font-bold text-sm shrink-0">
                      1
                    </div>
                    <div className="w-0.5 h-full bg-border" />
                  </div>
                  <div className="pb-6">
                    <h3 className="font-medium">Guest Checks Out</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Booking status transitions to <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">checked_out</code>.
                      Room status automatically set to <Badge variant="outline" className="text-xs">dirty</Badge>.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold text-sm shrink-0">
                      2
                    </div>
                    <div className="w-0.5 h-full bg-border" />
                  </div>
                  <div className="pb-6">
                    <h3 className="font-medium">Cleaning Task Auto-Created</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      A high-priority checkout cleaning task is automatically created with a detailed checklist.
                      The task includes room number, estimated duration (45 min), and is immediately available for assignment.
                    </p>
                    <Badge variant="outline" className="mt-2 text-xs">Priority: High</Badge>
                    <Badge variant="outline" className="mt-2 ml-1 text-xs">Duration: 45 min</Badge>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold text-sm shrink-0">
                      3
                    </div>
                    <div className="w-0.5 h-full bg-border" />
                  </div>
                  <div className="pb-6">
                    <h3 className="font-medium">Staff Completes Cleaning</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Assigned staff completes the cleaning task. On completion, the room is moved to{' '}
                      <Badge variant="outline" className="text-xs">inspected</Badge> status automatically,
                      recording the staff member and timestamps.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-400 font-bold text-sm shrink-0">
                      4
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium">Supervisor Inspects & Releases</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Supervisor verifies quality and releases the room. Room transitions to{' '}
                      <Badge variant="outline" className="text-xs">clean</Badge> and status{' '}
                      <Badge variant="outline" className="text-xs">available</Badge>.
                      The room is now ready for the next guest.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog !== null} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog === 'recurring' ? 'Execute Recurring Task Generator' : 'Execute PM Auto-Trigger'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog === 'recurring'
                ? 'This will scan all completed recurring tasks and create new instances for those that are due. This action will create real tasks in the system.'
                : 'This will check all overdue preventive maintenance items and create maintenance tasks. This action will create real tasks in the system.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                confirmDialog === 'recurring'
                  ? triggerRecurringTasks(true)
                  : triggerPMAutoCheck(true)
              }
            >
              <Timer className="mr-1 h-3 w-3" />
              Dry Run First
            </Button>
            <Button
              onClick={() =>
                confirmDialog === 'recurring'
                  ? triggerRecurringTasks(false)
                  : triggerPMAutoCheck(false)
              }
            >
              <Play className="mr-1 h-3 w-3" />
              Execute Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
