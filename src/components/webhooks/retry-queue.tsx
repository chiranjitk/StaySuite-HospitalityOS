'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, Play, X, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface RetryItem {
  id: string;
  deliveryId: string;
  endpointId: string;
  endpointName: string;
  event: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'failed';
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: string;
  lastError: string;
  createdAt: string;
}

export default function RetryQueue() {
  const [queue, setQueue] = useState<RetryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, failed: 0, nextRetry: null as string | null });

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      const response = await fetch('/api/webhooks/retry-queue');
      const data = await response.json();
      if (data.success) {
        setQueue(data.data.queue);
        setStats(data.data.stats);
      }
    } catch {
      console.error('Failed to fetch retry queue');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (retryId: string) => {
    try {
      const response = await fetch('/api/webhooks/retry-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retryId }),
      });

      if (response.ok) {
        toast.success('Retry initiated');
        fetchQueue();
      }
    } catch {
      toast.error('Failed to initiate retry');
    }
  };

  const handleCancel = async (retryId: string) => {
    try {
      const response = await fetch(`/api/webhooks/retry-queue?retryId=${retryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setQueue(queue.filter(q => q.id !== retryId));
        toast.success('Retry cancelled');
      }
    } catch {
      toast.error('Failed to cancel retry');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Retry Queue</h2>
          <p className="text-muted-foreground">Manage failed webhook delivery retries</p>
        </div>
        <Button variant="outline" onClick={fetchQueue}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Total in Queue</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Pending Retry</CardDescription>
            <CardTitle className="text-2xl">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription>Failed (Max Attempts)</CardDescription>
            <CardTitle className="text-2xl">{stats.failed}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Next Retry</CardDescription>
            <CardTitle className="text-2xl">
              {stats.nextRetry ? new Date(stats.nextRetry).toLocaleTimeString() : 'N/A'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Queue Table */}
      <Card>
        <CardContent className="pt-6">
          {queue.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No items in retry queue</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last Error</TableHead>
                  <TableHead>Next Retry</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.endpointName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.event}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'pending' ? 'default' : 'destructive'}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={item.attempts >= item.maxAttempts ? 'text-red-500 dark:text-red-400' : ''}>
                        {item.attempts}/{item.maxAttempts}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {item.lastError}
                    </TableCell>
                    <TableCell>
                      {item.nextRetryAt ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {new Date(item.nextRetryAt).toLocaleString()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.status === 'pending' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleRetry(item.id)}>
                              <Play className="h-4 w-4 mr-1" />
                              Retry
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleCancel(item.id)}>
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
