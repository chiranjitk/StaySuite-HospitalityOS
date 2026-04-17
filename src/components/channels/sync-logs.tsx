'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  History,
  Check,
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Clock,
  Filter,
  Download,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { exportToCSV } from '@/lib/export-utils';

interface SyncLog {
  id: string;
  connectionId: string;
  channelName: string;
  channelType: string;
  syncType: 'inventory' | 'rate' | 'booking' | 'restriction';
  direction: 'inbound' | 'outbound';
  status: 'success' | 'failed';
  statusCode: number | null;
  errorMessage: string | null;
  attemptCount: number;
  correlationId: string | null;
  createdAt: Date;
}

export default function SyncLogs() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/channels/sync-logs');
      const result = await response.json();
      if (result.success) {
        setLogs(result.data);
      } else {
        toast.error('Failed to load sync logs');
      }
    } catch (error) {
      console.error('Error fetching sync logs:', error);
      toast.error('Failed to load sync logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (activeTab === 'all') return true;
    if (activeTab === 'success') return log.status === 'success';
    if (activeTab === 'failed') return log.status === 'failed';
    return true;
  }).filter(log => {
    if (filterChannel !== 'all') return log.channelName === filterChannel;
    return true;
  }).filter(log => {
    if (filterType !== 'all') return log.syncType === filterType;
    return true;
  });

  // Stats
  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === 'success').length,
    failed: logs.filter(l => l.status === 'failed').length,
    successRate: logs.length > 0 ? Math.round((logs.filter(l => l.status === 'success').length / logs.length) * 100) : 0,
  };

  const channels = [...new Set(logs.map(l => l.channelName))];
  const syncTypes = ['inventory', 'rate', 'booking', 'restriction'];

  const getSyncTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      inventory: 'bg-cyan-100 text-cyan-700',
      rate: 'bg-amber-100 text-amber-700',
      booking: 'bg-purple-100 text-purple-700',
      restriction: 'bg-slate-100 text-slate-700',
    };
    return styles[type] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync Logs</h1>
          <p className="text-muted-foreground">View all channel synchronization history</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToCSV(
            filteredLogs.map(log => ({
              timestamp: String(new Date(log.createdAt)),
              channel: log.channelName,
              type: log.syncType,
              direction: log.direction,
              status: log.status,
              statusCode: log.statusCode ?? '',
              attempts: log.attemptCount,
              errorMessage: log.errorMessage || '',
              correlationId: log.correlationId || '',
            })),
            `sync-logs-${new Date().toISOString().slice(0, 10)}`,
            [
              { key: 'timestamp', label: 'Timestamp' },
              { key: 'channel', label: 'Channel' },
              { key: 'type', label: 'Sync Type' },
              { key: 'direction', label: 'Direction' },
              { key: 'status', label: 'Status' },
              { key: 'statusCode', label: 'HTTP Code' },
              { key: 'attempts', label: 'Attempts' },
              { key: 'errorMessage', label: 'Error' },
              { key: 'correlationId', label: 'Correlation ID' },
            ]
          )}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <History className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Logs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.success}</p>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <X className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <AlertTriangle className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.successRate}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="success">
              <Check className="h-4 w-4 mr-1 text-emerald-500" />
              Success
            </TabsTrigger>
            <TabsTrigger value="failed">
              <X className="h-4 w-4 mr-1 text-red-500" />
              Failed
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            {channels.map((channel) => (
              <SelectItem key={channel} value={channel}>{channel}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {syncTypes.map((type) => (
              <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {filteredLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>HTTP Code</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Correlation ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} className={log.status === 'failed' ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span>{format(new Date(log.createdAt), 'MMM dd, yyyy')}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(log.createdAt), 'HH:mm:ss')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.channelName}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSyncTypeBadge(log.syncType)}>
                          {log.syncType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.direction === 'inbound' ? (
                          <div className="flex items-center gap-1 text-cyan-600">
                            <ArrowDownToLine className="h-4 w-4" />
                            Inbound
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-purple-600">
                            <ArrowUpFromLine className="h-4 w-4" />
                            Outbound
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.status === 'success' ? (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <Check className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700">
                            <X className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={log.statusCode && log.statusCode >= 400 ? 'text-red-600 font-mono' : 'text-emerald-600 font-mono'}>
                          {log.statusCode || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={log.attemptCount > 1 ? 'text-amber-600' : ''}>
                          {log.attemptCount}
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.errorMessage ? (
                          <span className="text-red-600 text-sm truncate max-w-[200px] block" title={log.errorMessage}>
                            {log.errorMessage}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {log.correlationId || '—'}
                        </code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No sync logs found</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
