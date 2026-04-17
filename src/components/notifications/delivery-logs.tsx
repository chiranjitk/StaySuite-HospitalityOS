'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Mail, MessageSquare, Bell, Smartphone, Check, X, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeliveryLog {
  id: string;
  type: 'email' | 'sms' | 'push' | 'in_app';
  template: string;
  recipient: string;
  subject?: string;
  body?: string;
  status: 'delivered' | 'failed' | 'bounced' | 'pending';
  sentAt: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  errorMessage?: string;
}

const typeIcons = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
  in_app: Smartphone,
};

const statusColors = {
  delivered: 'bg-emerald-500',
  failed: 'bg-red-500',
  bounced: 'bg-amber-500',
  pending: 'bg-gray-500',
};

export default function DeliveryLogs() {
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, delivered: 0, failed: 0, bounced: 0, deliveryRate: '0' });

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/notifications/delivery-logs');
      const data = await response.json();
      if (data.success) {
        setLogs(data.data.logs);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch delivery logs');
    } finally {
      setLoading(false);
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
          <h2 className="text-2xl font-bold tracking-tight">Delivery Logs</h2>
          <p className="text-muted-foreground">Track notification delivery status and performance</p>
        </div>
        <Button variant="outline" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Sent</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Delivered</CardDescription>
            <CardTitle className="text-2xl">{stats.delivered}</CardTitle>
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
            <CardDescription>Bounced</CardDescription>
            <CardTitle className="text-2xl">{stats.bounced}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Delivery Rate</CardDescription>
            <CardTitle className="text-2xl">{stats.deliveryRate}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Delivered At</TableHead>
                <TableHead>Engagement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const Icon = typeIcons[log.type];
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{log.type}</span>
                      </div>
                    </TableCell>
                    <TableCell>{log.template}</TableCell>
                    <TableCell className="font-mono text-xs">{log.recipient}</TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[log.status]} text-white capitalize`}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(log.sentAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {log.deliveredAt ? new Date(log.deliveredAt).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {log.openedAt && (
                          <span className="text-xs text-muted-foreground">
                            Opened: {new Date(log.openedAt).toLocaleTimeString()}
                          </span>
                        )}
                        {log.clickedAt && (
                          <span className="text-xs text-muted-foreground">
                            Clicked: {new Date(log.clickedAt).toLocaleTimeString()}
                          </span>
                        )}
                        {log.errorMessage && (
                          <span className="text-xs text-red-500">{log.errorMessage}</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
