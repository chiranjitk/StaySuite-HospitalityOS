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
import { Progress } from '@/components/ui/progress';
import { Loader2, Key, Plus, Settings, Trash2, Copy, RefreshCw, Power } from 'lucide-react';
import { toast } from 'sonner';

interface ThirdPartyApi {
  id: string;
  name: string;
  category: 'mapping' | 'communication' | 'data' | 'payment' | 'analytics' | 'other';
  status: 'active' | 'inactive';
  apiKey: string;
  endpoint: string;
  lastUsed?: string;
  requestCount: number;
  rateLimit: {
    used: number;
    limit: number;
    period: string;
  };
}

const categoryOptions = [
  { value: 'mapping', label: 'Mapping & Location' },
  { value: 'communication', label: 'Communication' },
  { value: 'data', label: 'Data Services' },
  { value: 'payment', label: 'Payment' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'other', label: 'Other' },
];

const categoryColors = {
  mapping: 'from-green-500/20 to-emerald-500/20',
  communication: 'from-cyan-500/20 to-teal-500/20',
  data: 'from-amber-500/20 to-orange-500/20',
  payment: 'from-emerald-500/20 to-green-500/20',
  analytics: 'from-violet-500/20 to-purple-500/20',
  other: 'from-gray-500/20 to-slate-500/20',
};

export default function ThirdPartyApis() {
  const [apis, setApis] = useState<ThirdPartyApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, totalRequests: 0 });
  const [editApi, setEditApi] = useState<ThirdPartyApi | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchApis();
  }, []);

  const fetchApis = async () => {
    try {
      const response = await fetch('/api/integrations/third-party-apis');
      const data = await response.json();
      if (data.success) {
        setApis(data.data.apis);
        setStats(data.data.stats);
      }
    } catch (error) {
      toast.error('Failed to fetch third-party APIs');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApi = async () => {
    if (!editApi) return;

    try {
      const method = editApi.id && editApi.id !== '' ? 'PUT' : 'POST';
      const response = await fetch('/api/integrations/third-party-apis', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editApi),
      });

      if (response.ok) {
        const data = await response.json();
        if (method === 'POST') {
          setApis([...apis, data.data]);
          toast.success('API added successfully');
        } else {
          setApis(apis.map(a => a.id === editApi.id ? editApi : a));
          toast.success('API updated successfully');
        }
        fetchApis();
      }
    } catch {
      toast.error('Failed to save API');
    }
    setDialogOpen(false);
    setEditApi(null);
  };

  const handleDeleteApi = async (id: string) => {
    try {
      const response = await fetch(`/api/integrations/third-party-apis?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setApis(apis.filter(a => a.id !== id));
        toast.success('API deleted successfully');
        fetchApis();
      }
    } catch {
      toast.error('Failed to delete API');
    }
  };

  const handleToggleStatus = async (id: string) => {
    const api = apis.find(a => a.id === id);
    if (!api) return;

    try {
      const response = await fetch('/api/integrations/third-party-apis', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: api.status === 'active' ? 'inactive' : 'active' }),
      });

      if (response.ok) {
        setApis(apis.map(a => 
          a.id === id ? { ...a, status: a.status === 'active' ? 'inactive' : 'active' } : a
        ));
        toast.success('API status updated');
      }
    } catch {
      toast.error('Failed to update API status');
    }
  };

  const handleCopyKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    toast.success('API key copied to clipboard');
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
          <h2 className="text-2xl font-bold tracking-tight">Third-Party APIs</h2>
          <p className="text-muted-foreground">Manage external API integrations and keys</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditApi({ id: '', name: '', category: 'other', status: 'inactive', apiKey: '', endpoint: '', requestCount: 0, rateLimit: { used: 0, limit: 1000, period: 'day' } })}>
              <Plus className="h-4 w-4 mr-2" />
              Add API
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editApi?.id ? 'Edit API' : 'Add Third-Party API'}</DialogTitle>
              <DialogDescription>Configure your API integration</DialogDescription>
            </DialogHeader>
            {editApi && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">API Name</Label>
                    <Input
                      id="name"
                      value={editApi.name}
                      onChange={(e) => setEditApi({ ...editApi, name: e.target.value })}
                      placeholder="My API"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={editApi.category}
                      onValueChange={(v: any) => setEditApi({ ...editApi, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endpoint">API Endpoint</Label>
                  <Input
                    id="endpoint"
                    value={editApi.endpoint}
                    onChange={(e) => setEditApi({ ...editApi, endpoint: e.target.value })}
                    placeholder="https://api.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={editApi.apiKey}
                    onChange={(e) => setEditApi({ ...editApi, apiKey: e.target.value })}
                    placeholder="Enter API key"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rateLimit">Rate Limit</Label>
                    <Input
                      id="rateLimit"
                      type="number"
                      value={editApi.rateLimit.limit}
                      onChange={(e) => setEditApi({ ...editApi, rateLimit: { ...editApi.rateLimit, limit: parseInt(e.target.value) || 1000 } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period">Period</Label>
                    <Select
                      value={editApi.rateLimit.period}
                      onValueChange={(v) => setEditApi({ ...editApi, rateLimit: { ...editApi.rateLimit, period: v } })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minute">Per Minute</SelectItem>
                        <SelectItem value="hour">Per Hour</SelectItem>
                        <SelectItem value="day">Per Day</SelectItem>
                        <SelectItem value="month">Per Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveApi}>Save API</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Active APIs</CardDescription>
            <CardTitle className="text-2xl">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Total APIs</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Requests</CardDescription>
            <CardTitle className="text-2xl">{stats.totalRequests.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Categories</CardDescription>
            <CardTitle className="text-2xl">{new Set(apis.map(a => a.category)).size}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* APIs Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>API</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Rate Limit</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apis.map((api) => (
                <TableRow key={api.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${categoryColors[api.category]} flex items-center justify-center`}>
                        <Key className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{api.name}</p>
                        <p className="text-xs text-muted-foreground">Last used: {api.lastUsed ? new Date(api.lastUsed).toLocaleDateString() : 'Never'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{api.category}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[200px] truncate">{api.endpoint}</TableCell>
                  <TableCell>
                    <div className="w-24">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>{api.rateLimit.used}</span>
                        <span>{api.rateLimit.limit}</span>
                      </div>
                      <Progress value={(api.rateLimit.used / api.rateLimit.limit) * 100} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell>{api.requestCount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={api.status === 'active' ? 'default' : 'secondary'} className={api.status === 'active' ? 'bg-emerald-500' : ''}>
                      {api.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleCopyKey(api.apiKey)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(api.id)}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditApi(api); setDialogOpen(true); }}>
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteApi(api.id)}>
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
    </div>
  );
}
