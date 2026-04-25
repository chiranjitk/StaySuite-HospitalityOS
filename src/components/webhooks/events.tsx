'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Loader2, Webhook, Plus, Settings, Trash2, Copy, Eye, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  lastTriggered?: string;
  totalTriggers: number;
  successRate: number;
}

const eventTypes = [
  { value: 'booking.created', label: 'Booking Created' },
  { value: 'booking.updated', label: 'Booking Updated' },
  { value: 'booking.cancelled', label: 'Booking Cancelled' },
  { value: 'booking.checked_in', label: 'Guest Checked In' },
  { value: 'booking.checked_out', label: 'Guest Checked Out' },
  { value: 'payment.created', label: 'Payment Received' },
  { value: 'payment.refunded', label: 'Payment Refunded' },
  { value: 'payment.failed', label: 'Payment Failed' },
  { value: 'guest.created', label: 'Guest Created' },
  { value: 'guest.updated', label: 'Guest Updated' },
  { value: 'room.status_changed', label: 'Room Status Changed' },
  { value: 'task.created', label: 'Task Created' },
  { value: 'task.completed', label: 'Task Completed' },
];

export default function WebhookEvents() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, totalTriggers: 0, avgSuccessRate: 0 });
  const [editEndpoint, setEditEndpoint] = useState<WebhookEndpoint | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<WebhookEndpoint | null>(null);

  useEffect(() => {
    fetchEndpoints();
  }, []);

  const fetchEndpoints = async () => {
    try {
      const response = await fetch('/api/webhooks/events');
      const data = await response.json();
      if (data.success) {
        setEndpoints(data.data.endpoints);
        setStats(data.data.stats);
      }
    } catch (error) {
      toast.error('Failed to fetch webhook endpoints');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editEndpoint) return;

    try {
      const method = editEndpoint.id && editEndpoint.id !== '' ? 'PUT' : 'POST';
      const response = await fetch('/api/webhooks/events', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editEndpoint),
      });

      if (response.ok) {
        const data = await response.json();
        if (method === 'POST') {
          setEndpoints([...endpoints, data.data]);
          toast.success('Webhook endpoint created');
        } else {
          fetchEndpoints();
          toast.success('Webhook endpoint updated');
        }
      }
    } catch {
      toast.error('Failed to save webhook endpoint');
    }
    setDialogOpen(false);
    setEditEndpoint(null);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/webhooks/events?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setEndpoints(endpoints.filter(e => e.id !== id));
        toast.success('Webhook endpoint deleted');
      }
    } catch {
      toast.error('Failed to delete webhook endpoint');
    }
  };

  const handleToggleStatus = async (id: string) => {
    const endpoint = endpoints.find(e => e.id === id);
    if (!endpoint) return;

    try {
      const response = await fetch('/api/webhooks/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: endpoint.status === 'active' ? 'inactive' : 'active' }),
      });

      if (response.ok) {
        setEndpoints(endpoints.map(e => 
          e.id === id ? { ...e, status: e.status === 'active' ? 'inactive' : 'active' } : e
        ));
        toast.success('Webhook status updated');
      }
    } catch {
      toast.error('Failed to update webhook status');
    }
  };

  const handleCopySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast.success('Secret copied to clipboard');
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
          <h2 className="text-2xl font-bold tracking-tight">Webhook Endpoints</h2>
          <p className="text-muted-foreground">Manage webhook endpoints for event notifications</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditEndpoint({ id: '', name: '', url: '', secret: '', events: [], status: 'active', createdAt: new Date().toISOString(), totalTriggers: 0, successRate: 0 })}>
              <Plus className="h-4 w-4 mr-2" />
              Add Endpoint
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editEndpoint?.id ? 'Edit Webhook' : 'Add Webhook Endpoint'}</DialogTitle>
              <DialogDescription>Configure your webhook endpoint</DialogDescription>
            </DialogHeader>
            {editEndpoint && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editEndpoint.name}
                    onChange={(e) => setEditEndpoint({ ...editEndpoint, name: e.target.value })}
                    placeholder="My Webhook"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    value={editEndpoint.url}
                    onChange={(e) => setEditEndpoint({ ...editEndpoint, url: e.target.value })}
                    placeholder="https://api.example.com/webhooks"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secret Key</Label>
                  <Input
                    type="password"
                    value={editEndpoint.secret}
                    onChange={(e) => setEditEndpoint({ ...editEndpoint, secret: e.target.value })}
                    placeholder="whsec_xxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Events to Subscribe</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                    {eventTypes.map(event => (
                      <div key={event.value} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={event.value}
                          checked={editEndpoint.events.includes(event.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditEndpoint({ ...editEndpoint, events: [...editEndpoint.events, event.value] });
                            } else {
                              setEditEndpoint({ ...editEndpoint, events: editEndpoint.events.filter(ev => ev !== event.value) });
                            }
                          }}
                          className="h-4 w-4"
                        />
                        <label htmlFor={event.value} className="text-sm">{event.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="status"
                    checked={editEndpoint.status === 'active'}
                    onCheckedChange={(v) => setEditEndpoint({ ...editEndpoint, status: v ? 'active' : 'inactive' })}
                  />
                  <Label htmlFor="status">Active</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Endpoint</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Active Endpoints</CardDescription>
            <CardTitle className="text-2xl">{endpoints.filter(e => e.status === 'active').length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Triggers</CardDescription>
            <CardTitle className="text-2xl">{endpoints.reduce((sum, e) => sum + e.totalTriggers, 0).toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Avg Success Rate</CardDescription>
            <CardTitle className="text-2xl">
              {endpoints.length > 0 
                ? (endpoints.reduce((sum, e) => sum + e.successRate, 0) / endpoints.filter(e => e.totalTriggers > 0).length || 0).toFixed(1)
                : 0}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Event Types</CardDescription>
            <CardTitle className="text-2xl">{new Set(endpoints.flatMap(e => e.events)).size}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Endpoints Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Triggers</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Last Triggered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map((endpoint) => (
                <TableRow key={endpoint.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{endpoint.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[200px] truncate">{endpoint.url}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{endpoint.events.length} events</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={endpoint.status === 'active' ? 'default' : 'secondary'} className={endpoint.status === 'active' ? 'bg-emerald-500' : ''}>
                      {endpoint.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{endpoint.totalTriggers.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${endpoint.successRate >= 95 ? 'bg-emerald-500' : endpoint.successRate >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${endpoint.successRate}%` }}
                        />
                      </div>
                      <span className="text-sm">{endpoint.successRate}%</span>
                    </div>
                  </TableCell>
                  <TableCell>{endpoint.lastTriggered ? new Date(endpoint.lastTriggered).toLocaleString() : 'Never'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedEndpoint(endpoint); setDetailOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleCopySecret(endpoint.secret)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={endpoint.status === 'active'}
                        onCheckedChange={() => handleToggleStatus(endpoint.id)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => { setEditEndpoint(endpoint); setDialogOpen(true); }}>
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500 dark:text-red-400" onClick={() => handleDelete(endpoint.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedEndpoint?.name}</DialogTitle>
            <DialogDescription>Webhook Endpoint Details</DialogDescription>
          </DialogHeader>
          {selectedEndpoint && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">URL</Label>
                <p className="font-mono text-sm break-all">{selectedEndpoint.url}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Secret</Label>
                <p className="font-mono text-sm">{'*'.repeat(20)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Subscribed Events</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedEndpoint.events.map(event => (
                    <Badge key={event} variant="outline">{eventTypes.find(e => e.value === event)?.label || event}</Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="text-sm">{new Date(selectedEndpoint.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Triggered</Label>
                  <p className="text-sm">{selectedEndpoint.lastTriggered ? new Date(selectedEndpoint.lastTriggered).toLocaleString() : 'Never'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
