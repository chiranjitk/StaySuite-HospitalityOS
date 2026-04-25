'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wrench,
  Plus,
  Search,
  Loader2,
  RefreshCw,
  Filter,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  MoreHorizontal,
  Pencil,
  Trash2,
  Play,
  Pause,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface WorkOrder {
  id: string;
  workOrderNumber: string;
  title: string;
  description?: string;
  type: string;
  priority: string;
  status: string;
  propertyId?: string;
  requestedBy?: string;
  scheduledDate?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  estimatedHours?: number | null;
  notes?: string;
  createdAt: string;
  vendor?: {
    id: string;
    name: string;
    phone?: string;
    type?: string;
  } | null;
  payments?: Array<{
    id: string;
    amount: number;
    paidAt?: string | null;
  }>;
}

interface Property {
  id: string;
  name: string;
}

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700', icon: Clock },
  assigned: { label: 'Assigned', className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800', icon: Wrench },
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800', icon: Play },
  on_hold: { label: 'On Hold', className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800', icon: Pause },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800', icon: XCircle },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const typeLabels: Record<string, string> = {
  general: 'General',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  hvac: 'HVAC',
  carpentry: 'Carpentry',
  painting: 'Painting',
  appliance: 'Appliance',
  structural: 'Structural',
  cleaning: 'Cleaning',
  other: 'Other',
};

interface WorkOrdersProps {
  propertyId?: string;
}

export default function WorkOrders({ propertyId }: WorkOrdersProps) {
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    overdue: 0,
    totalEstimatedCost: 0,
    totalActualCost: 0,
    statusDistribution: [] as Array<{ status: string; count: number }>,
  });

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    propertyId: '',
    vendorId: '',
    roomId: '',
    title: '',
    description: '',
    type: 'general',
    priority: 'medium',
    scheduledDate: '',
    estimatedCost: '',
    estimatedHours: '',
    notes: '',
  });

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (result.success) {
          setProperties(result.data);
          if (result.data.length > 0 && !propertyId) {
            setFormData(prev => ({ ...prev, propertyId: result.data[0].id }));
          }
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, [propertyId]);

  // Fetch work orders
  const fetchWorkOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyId) params.append('propertyId', propertyId);
      else if (formData.propertyId) params.append('propertyId', formData.propertyId);
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const response = await fetch(`/api/maintenance/work-orders?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setWorkOrders(result.data);
        setStats({
          total: result.stats.totalWorkOrders || 0,
          overdue: result.stats.overdueWorkOrders || 0,
          totalEstimatedCost: result.stats.totalEstimatedCost || 0,
          totalActualCost: result.stats.totalActualCost || 0,
          statusDistribution: result.stats.statusDistribution || [],
        });
      }
    } catch (error) {
      console.error('Error fetching work orders:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch work orders',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, formData.propertyId, search, statusFilter, priorityFilter, typeFilter, toast]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  const resetForm = () => {
    setFormData({
      propertyId: propertyId || formData.propertyId || properties[0]?.id || '',
      vendorId: '',
      roomId: '',
      title: '',
      description: '',
      type: 'general',
      priority: 'medium',
      scheduledDate: '',
      estimatedCost: '',
      estimatedHours: '',
      notes: '',
    });
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.propertyId) {
      toast({ title: 'Validation Error', description: 'Title and property are required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/maintenance/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : null,
          estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
          scheduledDate: formData.scheduledDate || null,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Work order created' });
        setIsCreateOpen(false);
        resetForm();
        fetchWorkOrders();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create work order', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error creating work order:', error);
      toast({ title: 'Error', description: 'Failed to create work order', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const response = await fetch('/api/maintenance/work-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: `Work order status updated to ${status}` });
        fetchWorkOrders();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to update', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update work order', variant: 'destructive' });
    }
  };

  const handleEdit = () => {
    if (!selectedWorkOrder) return;
    setFormData({
      propertyId: selectedWorkOrder.propertyId || '',
      vendorId: selectedWorkOrder.vendor?.id || '',
      roomId: '',
      title: selectedWorkOrder.title,
      description: selectedWorkOrder.description || '',
      type: selectedWorkOrder.type,
      priority: selectedWorkOrder.priority,
      scheduledDate: selectedWorkOrder.scheduledDate ? format(new Date(selectedWorkOrder.scheduledDate), 'yyyy-MM-dd') : '',
      estimatedCost: selectedWorkOrder.estimatedCost?.toString() || '',
      estimatedHours: selectedWorkOrder.estimatedHours?.toString() || '',
      notes: selectedWorkOrder.notes || '',
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedWorkOrder) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/maintenance/work-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedWorkOrder.id,
          ...formData,
          estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : null,
          estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
          scheduledDate: formData.scheduledDate || null,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Work order updated' });
        setIsEditOpen(false);
        setSelectedWorkOrder(null);
        fetchWorkOrders();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to update', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status];
    if (!config) return <Badge variant="outline">{status}</Badge>;
    const Icon = config.icon;
    return (
      <Badge variant="secondary" className={cn('gap-1', config.className)}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const config = priorityConfig[priority];
    return (
      <Badge variant="outline" className={cn(config?.className)}>
        {config?.label || priority}
      </Badge>
    );
  };

  const pendingCount = stats.statusDistribution.find(s => s.status === 'pending')?.count || 0;
  const inProgressCount = stats.statusDistribution.find(s => s.status === 'in_progress')?.count || 0;
  const completedCount = stats.statusDistribution.find(s => s.status === 'completed')?.count || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Work Orders
          </h2>
          <p className="text-sm text-muted-foreground">
            Track and manage maintenance work orders
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchWorkOrders}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Work Order
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-500/10"><Clock className="h-4 w-4 text-gray-500" /></div>
            <div>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10"><Play className="h-4 w-4 text-amber-500 dark:text-amber-400" /></div>
            <div>
              <div className="text-2xl font-bold">{inProgressCount}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10"><CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /></div>
            <div>
              <div className="text-2xl font-bold">{completedCount}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10"><AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" /></div>
            <div>
              <div className="text-2xl font-bold">{stats.overdue}</div>
              <div className="text-xs text-muted-foreground">Overdue</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10"><DollarSign className="h-4 w-4 text-violet-500 dark:text-violet-400" /></div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalEstimatedCost)}</div>
              <div className="text-xs text-muted-foreground">Est. Cost</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search work orders..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(statusConfig).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                {Object.entries(priorityConfig).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(typeLabels).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : workOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Wrench className="h-12 w-12 mb-4" />
              <p>No work orders found</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>WO #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrders.map((wo) => (
                    <TableRow key={wo.id}>
                      <TableCell className="font-mono text-xs">{wo.workOrderNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{wo.title}</p>
                          {wo.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{wo.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabels[wo.type] || wo.type}</Badge>
                      </TableCell>
                      <TableCell>{getPriorityBadge(wo.priority)}</TableCell>
                      <TableCell>{getStatusBadge(wo.status)}</TableCell>
                      <TableCell className="text-sm">
                        {wo.requestedBy || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {wo.vendor ? wo.vendor.name : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {wo.estimatedCost ? formatCurrency(wo.estimatedCost) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(wo.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {wo.status === 'pending' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(wo.id, 'in_progress')}>
                                <Play className="h-4 w-4 mr-2" />Start
                              </DropdownMenuItem>
                            )}
                            {wo.status === 'in_progress' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(wo.id, 'completed')}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />Complete
                              </DropdownMenuItem>
                            )}
                            {wo.status === 'in_progress' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(wo.id, 'on_hold')}>
                                <Pause className="h-4 w-4 mr-2" />On Hold
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => { setSelectedWorkOrder(wo); handleEdit(); }}>
                              <Pencil className="h-4 w-4 mr-2" />Edit
                            </DropdownMenuItem>
                            {['pending', 'in_progress', 'assigned', 'on_hold'].includes(wo.status) && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateStatus(wo.id, 'cancelled')}
                                className="text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />Cancel
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Work Order</DialogTitle>
            <DialogDescription>Add a new maintenance work order</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Property *</Label>
              <Select value={formData.propertyId} onValueChange={v => setFormData(prev => ({ ...prev, propertyId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input placeholder="Work order title" value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Describe the issue..." value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={v => setFormData(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={v => setFormData(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Est. Cost</Label>
                <Input type="number" placeholder="0.00" value={formData.estimatedCost} onChange={e => setFormData(prev => ({ ...prev, estimatedCost: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Est. Hours</Label>
                <Input type="number" placeholder="0" value={formData.estimatedHours} onChange={e => setFormData(prev => ({ ...prev, estimatedHours: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Input type="date" value={formData.scheduledDate} onChange={e => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Work Order</DialogTitle>
            <DialogDescription>Update work order details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={v => setFormData(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={v => setFormData(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Est. Cost</Label>
                <Input type="number" value={formData.estimatedCost} onChange={e => setFormData(prev => ({ ...prev, estimatedCost: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Est. Hours</Label>
                <Input type="number" value={formData.estimatedHours} onChange={e => setFormData(prev => ({ ...prev, estimatedHours: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Input type="date" value={formData.scheduledDate} onChange={e => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
