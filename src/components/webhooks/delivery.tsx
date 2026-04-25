'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Webhook, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WebhookDelivery {
  id: string;
  endpointId: string;
  endpointName: string;
  event: string;
  payload: Record<string, unknown>;
  status: 'success' | 'failed' | 'pending';
  responseCode?: number;
  responseTime?: number;
  attempts: number;
  deliveredAt?: string;
  lastAttemptAt?: string;
  errorMessage?: string;
}

export default function WebhookDelivery() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, pending: 0 });

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    try {
      const response = await fetch('/api/webhooks/delivery');
      const data = await response.json();
      if (data.success) {
        setDeliveries(data.data.deliveries);
        setStats(data.data.stats);
      }
    } catch {
      console.error('Failed to fetch webhook deliveries');
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    success: 'bg-emerald-500',
    failed: 'bg-red-500',
    pending: 'bg-amber-500',
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
          <h2 className="text-2xl font-bold tracking-tight">Webhook Delivery</h2>
          <p className="text-muted-foreground">Track webhook delivery attempts and responses</p>
        </div>
        <Button variant="outline" onClick={fetchDeliveries}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Deliveries</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Successful</CardDescription>
            <CardTitle className="text-2xl">{stats.success}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="text-2xl">{stats.failed}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Deliveries Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Delivered At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{delivery.endpointName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{delivery.event}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[delivery.status]} text-white capitalize`}>
                      {delivery.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {delivery.responseCode && (
                        <span className={delivery.responseCode >= 200 && delivery.responseCode < 300 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}>
                          {delivery.responseCode}
                        </span>
                      )}
                      {delivery.responseTime && (
                        <span className="text-xs text-muted-foreground">{delivery.responseTime}ms</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{delivery.attempts}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {delivery.lastAttemptAt ? new Date(delivery.lastAttemptAt).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>
                    {delivery.deliveredAt ? new Date(delivery.deliveredAt).toLocaleString() : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
