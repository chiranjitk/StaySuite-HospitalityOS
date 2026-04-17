'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, CheckCircle, XCircle, AlertCircle, RefreshCw,
  Calendar, Zap, ChevronRight, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface ExecutionLog {
  id: string;
  ruleId: string;
  ruleName: string;
  triggerData: string | null;
  status: string;
  errorMessage: string | null;
  actionsResult: string | null;
  executedAt: string;
  rule?: {
    id: string;
    name: string;
    triggerEvent: string;
  };
}

interface LogStats {
  totalExecutions: number;
  successful: number;
  failed: number;
  successRate: number;
  executionsToday: number;
}

export default function ExecutionLogs() {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [stats, setStats] = useState<LogStats>({
    totalExecutions: 0,
    successful: 0,
    failed: 0,
    successRate: 0,
    executionsToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<ExecutionLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [statusFilter, dateFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      // Apply date filter
      const now = new Date();
      if (dateFilter === 'today') {
        params.append('startDate', new Date(now.setHours(0, 0, 0, 0)).toISOString());
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.append('startDate', weekAgo.toISOString());
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        params.append('startDate', monthAgo.toISOString());
      }

      const response = await fetch(`/api/automation/execution-logs?${params}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data.logs);
        setStats(data.data.stats);
      } else {
        // If no data from API, show empty state
        setLogs([]);
        setStats({
          totalExecutions: 0,
          successful: 0,
          failed: 0,
          successRate: 0,
          executionsToday: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to fetch execution logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Execution Logs</h1>
        <p className="text-muted-foreground">
          Monitor automation executions and troubleshoot issues
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Executions</p>
                <p className="text-2xl font-bold">{stats.totalExecutions.toLocaleString()}</p>
              </div>
              <Zap className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Today</p>
                <p className="text-2xl font-bold">{stats.executionsToday}</p>
              </div>
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold">{stats.successful}</p>
              </div>
              <CheckCircle className="h-5 w-5 text-cyan-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold">{stats.failed}</p>
              </div>
              <XCircle className="h-5 w-5 text-rose-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950 dark:to-violet-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{stats.successRate}%</p>
              </div>
              <RefreshCw className="h-5 w-5 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchLogs}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No execution logs found</h3>
            <p className="text-muted-foreground">
              {statusFilter !== 'all' || dateFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Logs will appear here when automations run'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Execution History</CardTitle>
            <CardDescription>
              Showing {logs.length} of {stats.totalExecutions} total executions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-1.5 ${
                        log.status === 'success' 
                          ? 'bg-emerald-100 dark:bg-emerald-900' 
                          : 'bg-red-100 dark:bg-red-900'
                      }`}>
                        {getStatusIcon(log.status)}
                      </div>
                      <div>
                        <p className="font-medium">{log.ruleName || log.rule?.name || 'Unknown Rule'}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(log.executedAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(log.status)}>
                        {log.status}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Execution Details</DialogTitle>
            <DialogDescription>
              {selectedLog?.ruleName || selectedLog?.rule?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedLog.status)}
                  <Badge className={getStatusColor(selectedLog.status)}>
                    {selectedLog.status}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(selectedLog.executedAt).toLocaleString()}
                </span>
              </div>

              <Separator />

              {/* Trigger Data */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Trigger Data</h4>
                <div className="p-3 bg-muted rounded-lg text-sm font-mono overflow-x-auto">
                  {selectedLog.triggerData ? (() => {
                    try {
                      return <pre>{JSON.stringify(JSON.parse(selectedLog.triggerData), null, 2)}</pre>;
                    } catch {
                      return <pre>{selectedLog.triggerData}</pre>;
                    }
                  })() : (
                    <span className="text-muted-foreground">No trigger data</span>
                  )}
                </div>
              </div>

              {/* Actions Result */}
              {selectedLog.status === 'success' && selectedLog.actionsResult && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Actions Result</h4>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-lg text-sm font-mono overflow-x-auto">
                    {(() => {
                      try {
                        return <pre>{JSON.stringify(JSON.parse(selectedLog.actionsResult), null, 2)}</pre>;
                      } catch {
                        return <pre>{selectedLog.actionsResult}</pre>;
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {selectedLog.status === 'failed' && selectedLog.errorMessage && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-red-600">Error</h4>
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg text-sm text-red-800 dark:text-red-200">
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}

              <Separator />

              <div className="text-sm text-muted-foreground">
                <p><strong>Rule ID:</strong> {selectedLog.ruleId}</p>
                <p><strong>Trigger:</strong> {selectedLog.rule?.triggerEvent || 'N/A'}</p>
                <p><strong>Log ID:</strong> {selectedLog.id}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
