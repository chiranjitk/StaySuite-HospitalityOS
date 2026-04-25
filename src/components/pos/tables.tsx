'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { usePropertyId } from '@/hooks/use-property';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Search, 
  Plus, 
  Loader2, 
  Grid3X3,
  Users,
  CheckCircle,
  Clock,
  Sparkles,
  AlertCircle,
  Edit,
  Trash2
} from 'lucide-react';

interface TableOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  items: {
    id: string;
    quantity: number;
    menuItem: {
      name: string;
    };
  }[];
}

interface Table {
  id: string;
  number: string;
  name?: string;
  capacity: number;
  area?: string;
  floor: number;
  status: string;
  orders?: TableOrder[];
  _count?: {
    orders: number;
  };
}

interface TableStats {
  statusCounts: Record<string, number>;
  totalCapacity: number;
  totalTables: number;
}

const statusConfig: Record<string, { color: string; bgColor: string; borderColor: string; icon: React.ReactNode }> = {
  available: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: <CheckCircle className="h-5 w-5" />,
  },
  occupied: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: <Users className="h-5 w-5" />,
  },
  reserved: {
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: <Clock className="h-5 w-5" />,
  },
  cleaning: {
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    icon: <Sparkles className="h-5 w-5" />,
  },
};

export default function Tables() {
  const { formatCurrency } = useCurrency();
  const { propertyId } = usePropertyId();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState<TableStats>({
    statusCounts: {},
    totalCapacity: 0,
    totalTables: 0,
  });

  // Dialog states
  const [addTableOpen, setAddTableOpen] = useState(false);
  const [editTable, setEditTable] = useState<Table | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTableId, setDeleteTableId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    number: '',
    name: '',
    capacity: '4',
    area: '',
    floor: '1',
    status: 'available',
  });

  const fetchTables = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('propertyId', propertyId);
      if (areaFilter !== 'all') params.append('area', areaFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (search) params.append('search', search);

      const [tablesRes, statsRes] = await Promise.all([
        fetch(`/api/tables?${params.toString()}`),
        fetch(`/api/tables?stats=true&propertyId=${propertyId}`),
      ]);

      const tablesData = await tablesRes.json();
      const statsData = await statsRes.json();

      if (tablesData.success) {
        setTables(tablesData.data);
      }

      if (statsData.success) {
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
      toast.error('Failed to fetch tables');
    } finally {
      setLoading(false);
    }
  }, [areaFilter, statusFilter, search, propertyId]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const resetForm = () => {
    setFormData({
      number: '',
      name: '',
      capacity: '4',
      area: '',
      floor: '1',
      status: 'available',
    });
  };

  const handleAddTable = async () => {
    if (!formData.number.trim()) {
      toast.error('Table number is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          number: formData.number,
          name: formData.name || undefined,
          capacity: parseInt(formData.capacity, 10),
          area: formData.area || undefined,
          floor: parseInt(formData.floor, 10),
          status: formData.status,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Table created successfully');
        setAddTableOpen(false);
        resetForm();
        fetchTables();
      } else {
        toast.error(data.error?.message || 'Failed to create table');
      }
    } catch (error) {
      console.error('Error creating table:', error);
      toast.error('Failed to create table');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTable = async () => {
    if (!editTable || !formData.number.trim()) {
      toast.error('Table number is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editTable.id,
          number: formData.number,
          name: formData.name || undefined,
          capacity: parseInt(formData.capacity, 10),
          area: formData.area || undefined,
          floor: parseInt(formData.floor, 10),
          status: formData.status,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Table updated successfully');
        setEditTable(null);
        resetForm();
        fetchTables();
      } else {
        toast.error(data.error?.message || 'Failed to update table');
      }
    } catch (error) {
      console.error('Error updating table:', error);
      toast.error('Failed to update table');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTable = (tableId: string) => {
    setDeleteTableId(tableId);
  };

  const confirmDeleteTable = async () => {
    if (!deleteTableId) return;

    try {
      const res = await fetch(`/api/tables?id=${deleteTableId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Table deleted successfully');
        fetchTables();
      } else {
        toast.error(data.error?.message || 'Failed to delete table');
      }
    } catch (error) {
      console.error('Error deleting table:', error);
      toast.error('Failed to delete table');
    } finally {
      setDeleteTableId(null);
    }
  };

  const updateTableStatus = async (tableId: string, status: string) => {
    try {
      const res = await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tableId, status }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Table status updated');
        fetchTables();
      } else {
        toast.error(data.error?.message || 'Failed to update table');
      }
    } catch (error) {
      console.error('Error updating table:', error);
      toast.error('Failed to update table');
    }
  };

  const openEditDialog = (table: Table) => {
    setEditTable(table);
    setFormData({
      number: table.number,
      name: table.name || '',
      capacity: table.capacity.toString(),
      area: table.area || '',
      floor: table.floor.toString(),
      status: table.status,
    });
  };

  // Get unique areas for filter
  const areas = [...new Set(tables.map(t => t.area).filter(Boolean))];

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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Tables</h1>
        <p className="text-muted-foreground">
          Manage restaurant tables and view their current status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTables}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.statusCounts.available || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupied</CardTitle>
            <Users className="h-4 w-4 text-red-500 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.statusCounts.occupied || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reserved</CardTitle>
            <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.statusCounts.reserved || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCapacity}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tables..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Areas</SelectItem>
                {areas.map(area => (
                  <SelectItem key={area} value={area || ''}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="cleaning">Cleaning</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={addTableOpen} onOpenChange={setAddTableOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Table
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add New Table</DialogTitle>
                  <DialogDescription>
                    Add a new table to the restaurant
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="number">Table Number *</Label>
                      <Input
                        id="number"
                        value={formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                        placeholder="e.g., T1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Name (Optional)</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Window Seat"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="capacity">Capacity</Label>
                      <Select
                        value={formData.capacity}
                        onValueChange={(v) => setFormData({ ...formData, capacity: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2, 4, 6, 8, 10, 12].map(cap => (
                            <SelectItem key={cap} value={cap.toString()}>{cap} seats</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="floor">Floor</Label>
                      <Select
                        value={formData.floor}
                        onValueChange={(v) => setFormData({ ...formData, floor: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map(f => (
                            <SelectItem key={f} value={f.toString()}>Floor {f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="area">Area</Label>
                      <Select
                        value={formData.area}
                        onValueChange={(v) => setFormData({ ...formData, area: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select area" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="indoor">Indoor</SelectItem>
                          <SelectItem value="outdoor">Outdoor</SelectItem>
                          <SelectItem value="patio">Patio</SelectItem>
                          <SelectItem value="vip">VIP</SelectItem>
                          <SelectItem value="bar">Bar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(v) => setFormData({ ...formData, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="occupied">Occupied</SelectItem>
                          <SelectItem value="reserved">Reserved</SelectItem>
                          <SelectItem value="cleaning">Cleaning</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddTableOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddTable}
                    disabled={saving}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Add Table
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Table Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {tables.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Grid3X3 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Tables Found</h3>
              <p className="text-muted-foreground text-center">
                {search || areaFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Add your first table to get started'}
              </p>
            </CardContent>
          </Card>
        ) : (
          tables.map((table) => {
            const config = statusConfig[table.status] || statusConfig.available;
            return (
              <Card
                key={table.id}
                className={`${config.bgColor} ${config.borderColor} border-2 overflow-hidden transition-all hover:shadow-lg cursor-pointer`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-xl ${config.color}`}>
                      {table.number}
                    </CardTitle>
                    <div className={config.color}>{config.icon}</div>
                  </div>
                  {table.name && (
                    <CardDescription className="text-xs">
                      {table.name}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      <Users className="h-3 w-3 inline mr-1" />
                      {table.capacity} seats
                    </span>
                    {table.area && (
                      <Badge variant="outline" className="text-xs">
                        {table.area}
                      </Badge>
                    )}
                  </div>

                  <Badge className={`${config.bgColor} ${config.color} border ${config.borderColor}`}>
                    {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                  </Badge>

                  {/* Show active order info if occupied */}
                  {table.status === 'occupied' && table.orders && table.orders.length > 0 && (
                    <div className="pt-2 border-t border-muted">
                      <p className="text-xs font-medium text-muted-foreground">Active Order:</p>
                      <p className="text-sm font-semibold">{formatCurrency(table.orders[0].totalAmount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {table.orders[0].items.length} items
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7"
                      onClick={() => openEditDialog(table)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    {table.status === 'occupied' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                        onClick={() => updateTableStatus(table.id, 'cleaning')}
                      >
                        Clear
                      </Button>
                    )}
                    {table.status === 'cleaning' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                        onClick={() => updateTableStatus(table.id, 'available')}
                      >
                        Done
                      </Button>
                    )}
                    {table.status === 'available' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-amber-600 dark:text-amber-400 hover:text-amber-700"
                        onClick={() => updateTableStatus(table.id, 'reserved')}
                      >
                        Reserve
                      </Button>
                    )}
                    {table.status === 'reserved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                        onClick={() => updateTableStatus(table.id, 'available')}
                      >
                        Free
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTableId} onOpenChange={(open) => !open && setDeleteTableId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Table</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this table? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTable} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTable} onOpenChange={(open) => !open && setEditTable(null)}>
        <DialogContent className="w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Table</DialogTitle>
            <DialogDescription>
              Update table details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-number">Table Number *</Label>
                <Input
                  id="edit-number"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-capacity">Capacity</Label>
                <Select
                  value={formData.capacity}
                  onValueChange={(v) => setFormData({ ...formData, capacity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 4, 6, 8, 10, 12].map(cap => (
                      <SelectItem key={cap} value={cap.toString()}>{cap} seats</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-floor">Floor</Label>
                <Select
                  value={formData.floor}
                  onValueChange={(v) => setFormData({ ...formData, floor: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(f => (
                      <SelectItem key={f} value={f.toString()}>Floor {f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-area">Area</Label>
                <Select
                  value={formData.area}
                  onValueChange={(v) => setFormData({ ...formData, area: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indoor">Indoor</SelectItem>
                    <SelectItem value="outdoor">Outdoor</SelectItem>
                    <SelectItem value="patio">Patio</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => {
                handleDeleteTable(editTable!.id);
                setEditTable(null);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button variant="outline" onClick={() => setEditTable(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditTable}
              disabled={saving}
              className="bg-gradient-to-r from-emerald-500 to-teal-600"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
