'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  TrendingDown, 
  Plus, 
  Search, 
  Loader2,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  Package,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCurrency } from '@/contexts/CurrencyContext';

interface StockItem {
  id: string;
  name: string;
  sku?: string;
  unit: string;
}

interface ConsumptionLog {
  id: string;
  stockItemId: string;
  stockItem: StockItem;
  quantity: number;
  type: string;
  reference?: string;
  cost?: number;
  notes?: string;
  recordedBy?: string;
  createdAt: string;
}

interface ConsumptionStats {
  totalLogs: number;
  totalQuantity: number;
  totalCost: number;
  typeDistribution: Array<{
    type: string;
    count: number;
    quantity: number;
  }>;
}

const LOG_TYPES = [
  { value: 'consumed', label: 'Consumed', icon: TrendingDown, color: 'text-red-500 dark:text-red-400' },
  { value: 'added', label: 'Added', icon: ArrowUpRight, color: 'text-emerald-500 dark:text-emerald-400' },
  { value: 'adjusted', label: 'Adjusted', icon: RotateCcw, color: 'text-amber-500 dark:text-amber-400' },
  { value: 'returned', label: 'Returned', icon: ArrowDownRight, color: 'text-cyan-500 dark:text-cyan-400' },
];

export default function ConsumptionLogs() {
  const { formatCurrency } = useCurrency();
  const [logs, setLogs] = useState<ConsumptionLog[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stats, setStats] = useState<ConsumptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    stockItemId: '',
    quantity: 0,
    type: 'consumed',
    reference: '',
    cost: 0,
    notes: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch consumption logs
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const response = await fetch(`/api/inventory/consumption?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data);
        setStats(data.stats);
      }

      // Fetch stock items for the dropdown
      const stockResponse = await fetch('/api/inventory/stock?limit=100');
      const stockData = await stockResponse.json();
      if (stockData.success) {
        setStockItems(stockData.data);
      }
    } catch (error) {
      console.error('Error fetching consumption logs:', error);
      toast.error('Failed to fetch consumption logs');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = () => {
    setFormData({
      stockItemId: '',
      quantity: 0,
      type: 'consumed',
      reference: '',
      cost: 0,
      notes: '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.stockItemId) {
      toast.error('Please select a stock item');
      return;
    }

    if (formData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/inventory/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockItemId: formData.stockItemId,
          quantity: formData.quantity,
          type: formData.type,
          reference: formData.reference || null,
          cost: formData.cost || null,
          notes: formData.notes || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Consumption log created');
        setDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to create log');
      }
    } catch (error) {
      console.error('Error creating consumption log:', error);
      toast.error('Failed to create consumption log');
    } finally {
      setSaving(false);
    }
  };

  const getTypeIcon = (type: string) => {
    const typeInfo = LOG_TYPES.find(t => t.value === type);
    if (!typeInfo) return <Package className="h-4 w-4" />;
    const Icon = typeInfo.icon;
    return <Icon className={`h-4 w-4 ${typeInfo.color}`} />;
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'consumed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'added': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'adjusted': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'returned': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  // Filter logs by search
  const filteredLogs = logs.filter(log => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      log.stockItem.name.toLowerCase().includes(searchLower) ||
      log.stockItem.sku?.toLowerCase().includes(searchLower) ||
      log.reference?.toLowerCase().includes(searchLower) ||
      log.notes?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Logs</CardTitle>
            <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats?.totalLogs || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20 border-teal-200 dark:border-teal-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-teal-700 dark:text-teal-400">Net Movement</CardTitle>
            <TrendingDown className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-700 dark:text-teal-300">{stats?.totalQuantity || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Total Cost</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(stats?.totalCost || 0)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950/20 dark:to-sky-950/20 border-cyan-200 dark:border-cyan-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Consumed Today</CardTitle>
            <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">
              {logs.filter(l => {
                const logDate = new Date(l.createdAt);
                const today = new Date();
                return logDate.toDateString() === today.toDateString() && l.type === 'consumed';
              }).reduce((sum, l) => sum + l.quantity, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by item, reference, or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {LOG_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full md:w-[160px]"
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full md:w-[160px]"
              placeholder="To"
            />
            <Button onClick={handleOpenDialog} className="bg-emerald-500 hover:bg-emerald-600">
              <Plus className="h-4 w-4 mr-2" />
              Log Entry
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Consumption Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Consumption History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500 dark:text-emerald-400" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No consumption logs found
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(log.createdAt), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(log.createdAt), 'HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{log.stockItem.name}</div>
                        {log.stockItem.sku && (
                          <div className="text-xs text-muted-foreground">
                            {log.stockItem.sku}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeBadgeColor(log.type)}>
                          <span className="flex items-center gap-1">
                            {getTypeIcon(log.type)}
                            {log.type}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={log.type === 'consumed' ? 'text-red-600 dark:text-red-400 font-medium' : log.type === 'added' ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                          {log.type === 'consumed' ? '-' : log.type === 'added' ? '+' : ''}
                          {log.quantity} {log.stockItem.unit}
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.cost ? formatCurrency(log.cost) : '-'}
                      </TableCell>
                      <TableCell>
                        {log.reference ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {log.reference}
                          </code>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {log.notes || '-'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Add Log Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Stock Movement</DialogTitle>
            <DialogDescription>
              Record a stock consumption, addition, adjustment, or return.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Stock Item *</Label>
              <Select
                value={formData.stockItemId}
                onValueChange={(v) => setFormData({ ...formData, stockItemId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {stockItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} {item.sku ? `(${item.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOG_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <t.icon className={`h-4 w-4 ${t.color}`} />
                          {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="Booking #, Task #, etc."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
