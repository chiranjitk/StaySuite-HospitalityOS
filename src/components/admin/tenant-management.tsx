'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Building2, Plus, MoreHorizontal, Edit, Trash2, Search, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { SectionGuard } from '@/components/common/section-guard';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'trial' | 'starter' | 'professional' | 'enterprise';
  status: 'trial' | 'active' | 'suspended' | 'cancelled';
  email: string;
  phone?: string;
  properties: number;
  users: number;
  rooms: number;
  subscriptionStart: string;
  subscriptionEnd?: string;
  trialEndsAt?: string;
  monthlyRevenue: number;
  usage: {
    storage: number;
    apiCalls: number;
    messages: number;
  };
  limits: {
    properties: number;
    users: number;
    rooms: number;
    storage: number;
  };
}

const planColors: Record<string, string> = {
  trial: 'bg-gray-500',
  starter: 'bg-emerald-500',
  professional: 'bg-cyan-500',
  enterprise: 'bg-violet-500',
};

const statusColors: Record<string, string> = {
  trial: 'bg-amber-500',
  active: 'bg-emerald-500',
  suspended: 'bg-red-500',
  cancelled: 'bg-gray-500',
};

const defaultLimits: Record<string, { properties: number; users: number; rooms: number; storage: number }> = {
  trial: { properties: 1, users: 3, rooms: 50, storage: 500 },
  starter: { properties: 1, users: 5, rooms: 50, storage: 1000 },
  professional: { properties: 5, users: 25, rooms: 500, storage: 5000 },
  enterprise: { properties: 20, users: 100, rooms: 2000, storage: 50000 },
};

export function TenantManagement() {
  const { formatCurrency } = useCurrency();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTenantId, setDeleteTenantId] = useState<string | null>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/admin/tenants');
      const data = await response.json();
      if (data.success) {
        setTenants(data.data.tenants);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Failed to fetch tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editTenant) return;
    
    setSaving(true);
    try {
      const isNew = !editTenant.id || editTenant.id === '';
      const url = '/api/admin/tenants';
      const method = isNew ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editTenant),
      });

      const data = await response.json();
      
      if (data.success) {
        if (isNew) {
          setTenants([...tenants, data.data]);
          toast.success('Tenant created successfully');
        } else {
          setTenants(tenants.map(t => t.id === editTenant.id ? editTenant : t));
          toast.success('Tenant updated successfully');
        }
        setDialogOpen(false);
        setEditTenant(null);
      } else {
        throw new Error(data.error || 'Failed to save tenant');
      }
    } catch (error) {
      console.error('Error saving tenant:', error);
      toast.error('Failed to save tenant');
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async (id: string) => {
    try {
      const tenant = tenants.find(t => t.id === id);
      if (!tenant) return;

      const newStatus = tenant.status === 'suspended' ? 'active' : 'suspended';
      
      const response = await fetch('/api/admin/tenants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });

      const data = await response.json();
      
      if (data.success) {
        setTenants(tenants.map(t => 
          t.id === id ? { ...t, status: newStatus } : t
        ));
        toast.success('Tenant status updated');
      } else {
        throw new Error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating tenant status:', error);
      toast.error('Failed to update tenant status');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTenantId(id);
  };

  const confirmDeleteTenant = async () => {
    if (!deleteTenantId) return;

    try {
      const response = await fetch(`/api/admin/tenants?id=${deleteTenantId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        setTenants(tenants.filter(t => t.id !== deleteTenantId));
        toast.success('Tenant deleted');
      } else {
        throw new Error(data.error || 'Failed to delete tenant');
      }
    } catch (error) {
      console.error('Error deleting tenant:', error);
      toast.error('Failed to delete tenant');
    } finally {
      setDeleteTenantId(null);
    }
  };

  const openNewTenantDialog = () => {
    setEditTenant({
      id: '',
      name: '',
      slug: '',
      plan: 'starter',
      status: 'active',
      email: '',
      properties: 0,
      users: 0,
      rooms: 0,
      subscriptionStart: new Date().toISOString(),
      monthlyRevenue: 0,
      usage: { storage: 0, apiCalls: 0, messages: 0 },
      limits: defaultLimits.starter,
    });
    setDialogOpen(true);
  };

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesPlan = filterPlan === 'all' || t.plan === filterPlan;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  // Update limits when plan changes
  useEffect(() => {
    if (editTenant && editTenant.id === '' && editTenant.plan) {
      setEditTenant({
        ...editTenant,
        limits: defaultLimits[editTenant.plan] || defaultLimits.starter,
      });
    }
  }, [editTenant?.plan]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SectionGuard permission="admin.tenants">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tenant Management</h2>
          <p className="text-muted-foreground">Manage all hotel tenants and subscriptions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewTenantDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tenant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editTenant?.id ? 'Edit Tenant' : 'Add New Tenant'}</DialogTitle>
              <DialogDescription>Configure tenant details and subscription</DialogDescription>
            </DialogHeader>
            {editTenant && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={editTenant.name} onChange={(e) => setEditTenant({ ...editTenant, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input value={editTenant.slug} onChange={(e) => setEditTenant({ ...editTenant, slug: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={editTenant.email} onChange={(e) => setEditTenant({ ...editTenant, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={editTenant.phone || ''} onChange={(e) => setEditTenant({ ...editTenant, phone: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select value={editTenant.plan} onValueChange={(v: Tenant['plan']) => setEditTenant({ ...editTenant, plan: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editTenant.status} onValueChange={(v: Tenant['status']) => setEditTenant({ ...editTenant, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Max Properties</Label>
                    <Input type="number" value={editTenant.limits.properties} onChange={(e) => setEditTenant({ ...editTenant, limits: { ...editTenant.limits, properties: parseInt(e.target.value) } })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Users</Label>
                    <Input type="number" value={editTenant.limits.users} onChange={(e) => setEditTenant({ ...editTenant, limits: { ...editTenant.limits, users: parseInt(e.target.value) } })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Rooms</Label>
                    <Input type="number" value={editTenant.limits.rooms} onChange={(e) => setEditTenant({ ...editTenant, limits: { ...editTenant.limits, rooms: parseInt(e.target.value) } })} />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Tenant
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Active Tenants</CardDescription>
            <CardTitle className="text-2xl">{tenants.filter(t => t.status === 'active').length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>On Trial</CardDescription>
            <CardTitle className="text-2xl">{tenants.filter(t => t.status === 'trial').length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription>Suspended</CardDescription>
            <CardTitle className="text-2xl">{tenants.filter(t => t.status === 'suspended').length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Properties</CardDescription>
            <CardTitle className="text-2xl">{tenants.reduce((sum, t) => sum + t.properties, 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Monthly Revenue</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(tenants.reduce((sum, t) => sum + t.monthlyRevenue, 0))}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search tenants..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Plan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Rooms</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">{tenant.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${planColors[tenant.plan]} text-white capitalize`}>{tenant.plan}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[tenant.status]} text-white capitalize`}>{tenant.status}</Badge>
                  </TableCell>
                  <TableCell>{tenant.properties}/{tenant.limits.properties}</TableCell>
                  <TableCell>{tenant.users}/{tenant.limits.users}</TableCell>
                  <TableCell>{tenant.rooms}/{tenant.limits.rooms}</TableCell>
                  <TableCell>{formatCurrency(tenant.monthlyRevenue)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditTenant(tenant); setDialogOpen(true); }}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSuspend(tenant.id)}>
                          {tenant.status === 'suspended' ? <Check className="h-4 w-4 mr-2" /> : <X className="h-4 w-4 mr-2" />}
                          {tenant.status === 'suspended' ? 'Activate' : 'Suspend'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(tenant.id)} className="text-red-500 dark:text-red-400">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredTenants.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No tenants found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTenantId} onOpenChange={(open) => !open && setDeleteTenantId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tenant? This action cannot be undone.
              All associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTenant} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </SectionGuard>
  );
}

export default TenantManagement;
