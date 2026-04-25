'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Check,
  X,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Edit,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';

interface RateSyncItem {
  id: string;
  connectionId: string;
  channelName: string;
  channelType: string;
  roomType: string;
  ratePlan: string;
  basePrice: number;
  channelPrice: number;
  priceDiff: number;
  currency: string;
  lastSync: Date | null;
  status: 'synced' | 'higher' | 'lower' | 'error' | 'pending';
  autoAdjust: boolean;
}

interface RateSyncStats {
  total: number;
  synced: number;
  outOfSync: number;
  errors: number;
  avgBasePrice: number;
}

export default function RateSync() {
  const { formatCurrency } = useCurrency();
  const [rateData, setRateData] = useState<RateSyncItem[]>([]);
  const [stats, setStats] = useState<RateSyncStats>({ total: 0, synced: 0, outOfSync: 0, errors: 0, avgBasePrice: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; item: RateSyncItem | null }>({ open: false, item: null });
  const [editPrice, setEditPrice] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/channels/rate-sync');
      const result = await response.json();
      
      if (result.success) {
        setRateData(result.data);
        setStats(result.stats);
      } else {
        toast.error('Failed to load rate sync status');
      }
    } catch (error) {
      console.error('Error fetching rate sync:', error);
      toast.error('Failed to load rate sync status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      // Call the real push API first
      const pushResponse = await fetch('/api/channel-manager/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all' }),
      });
      const pushResult = await pushResponse.json();

      // Create sync logs based on actual push results
      const uniqueConnections = [...new Set(rateData.map(d => d.connectionId))];
      for (const connectionId of uniqueConnections) {
        const channelResults = pushResult.data?.results || [];
        const matchedResult = channelResults.find(
          (r: { channel?: string; success: boolean }) => r.channel === connectionId
        );
        const logStatus = matchedResult?.success ? 'success' : 'failed';
        const errorMessage = matchedResult?.success ? undefined : matchedResult?.message || 'Sync failed';

        await fetch('/api/channels/sync-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId,
            syncType: 'rate',
            direction: 'outbound',
            status: logStatus,
            errorMessage,
            recordsProcessed: rateData.filter(d => d.connectionId === connectionId).length,
          }),
        });
      }

      if (pushResult.success) {
        toast.success(pushResult.message || 'Rate sync initiated for all channels');
      } else {
        toast.error(pushResult.error?.message || 'Failed to sync rates');
      }
      fetchData();
    } catch {
      toast.error('Failed to sync rates');
    } finally {
      setSyncing(false);
    }
  };

  const handleEditPrice = async () => {
    if (!editDialog.item) return;
    
    try {
      const response = await fetch('/api/channels/rate-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePrice',
          id: editDialog.item.id,
          channelPrice: parseFloat(editPrice),
        }),
      });
      const result = await response.json();
      if (result.success) {
        setRateData(prev => prev.map(item =>
          item.id === editDialog.item!.id
            ? { ...item, channelPrice: parseFloat(editPrice), priceDiff: parseFloat(editPrice) - item.basePrice }
            : item
        ));
        toast.success('Price updated successfully');
      } else {
        toast.error(result.error?.message || 'Failed to update price');
      }
    } catch {
      toast.error('Failed to connect to server');
    }
    setEditDialog({ open: false, item: null });
  };

  const handleToggleAutoAdjust = async (connectionId: string, autoAdjust: boolean) => {
    try {
      await fetch('/api/channels/connections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: connectionId,
          autoSync: autoAdjust,
        }),
      });
      
      setRateData(prev => prev.map(item => 
        item.connectionId === connectionId ? { ...item, autoAdjust } : item
      ));
      toast.success(`Auto-adjust ${autoAdjust ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update auto-adjust');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><Check className="h-3 w-3 mr-1" />Synced</Badge>;
      case 'higher':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><TrendingUp className="h-3 w-3 mr-1" />Higher</Badge>;
      case 'lower':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><TrendingDown className="h-3 w-3 mr-1" />Lower</Badge>;
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><AlertTriangle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Group by channel
  const groupedByChannel = rateData.reduce((acc, item) => {
    const key = item.channelName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, RateSyncItem[]>);

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
          <h1 className="text-2xl font-bold tracking-tight">Rate Sync</h1>
          <p className="text-muted-foreground">Manage rates across all distribution channels</p>
        </div>
        <Button onClick={handleSyncAll} disabled={syncing}>
          {syncing ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sync All Rates
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <DollarSign className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Rates</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.synced}</p>
                <p className="text-xs text-muted-foreground">Synced</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.outOfSync}</p>
                <p className="text-xs text-muted-foreground">Out of Sync</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <X className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.errors}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <DollarSign className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.avgBasePrice)}</p>
                <p className="text-xs text-muted-foreground">Avg Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rate Table by Channel */}
      {Object.keys(groupedByChannel).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No rate sync data available</p>
            <p className="text-sm text-muted-foreground">Connect channels and configure rate plans to see sync status</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByChannel).map(([channelName, items]) => {
            const syncedItems = items.filter(i => i.status === 'synced').length;
            const syncProgress = items.length > 0 ? Math.round((syncedItems / items.length) * 100) : 0;

            return (
              <Card key={channelName}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{channelName}</CardTitle>
                      <Badge variant="outline">{items.length} rate plans</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex-1">
                      <Progress value={syncProgress} className="h-2" />
                    </div>
                    <span className="text-sm font-medium">{syncProgress}% synced</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room Type</TableHead>
                        <TableHead>Rate Plan</TableHead>
                        <TableHead className="text-right">Base Price</TableHead>
                        <TableHead className="text-right">Channel Price</TableHead>
                        <TableHead className="text-right">Diff</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Auto Adjust</TableHead>
                        <TableHead>Last Sync</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.roomType}</TableCell>
                          <TableCell className="text-muted-foreground">{item.ratePlan}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.basePrice)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.priceDiff !== 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
                              {formatCurrency(item.channelPrice)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.priceDiff > 0 && (
                              <span className="text-amber-600 dark:text-amber-400 flex items-center justify-end gap-1">
                                <TrendingUp className="h-3 w-3" />
                                +{formatCurrency(Math.abs(item.priceDiff))}
                              </span>
                            )}
                            {item.priceDiff < 0 && (
                              <span className="text-red-600 dark:text-red-400 flex items-center justify-end gap-1">
                                <TrendingDown className="h-3 w-3" />
                                -{formatCurrency(Math.abs(item.priceDiff))}
                              </span>
                            )}
                            {item.priceDiff === 0 && (
                              <span className="text-emerald-600 dark:text-emerald-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell>
                            <Switch
                              checked={item.autoAdjust}
                              onCheckedChange={(checked) => handleToggleAutoAdjust(item.connectionId, checked)}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatLastSync(item.lastSync)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditDialog({ open: true, item });
                                setEditPrice(item.channelPrice.toString());
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Price Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, item: editDialog.item })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Channel Price</DialogTitle>
            <DialogDescription>
              Update the price for {editDialog.item?.roomType} on {editDialog.item?.channelName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Base Price (Reference)</Label>
              <div className="text-lg font-medium">{formatCurrency(editDialog.item?.basePrice || 0)}</div>
            </div>
            <div className="space-y-2">
              <Label>Channel Price</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, item: null })}>
              Cancel
            </Button>
            <Button onClick={handleEditPrice}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
