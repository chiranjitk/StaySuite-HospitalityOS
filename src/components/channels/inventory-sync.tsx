'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCw,
  Check,
  X,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Calendar,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

interface SyncStatus {
  connectionId: string;
  channelName: string;
  channelType: string;
  roomType: string;
  available: number;
  total: number;
  lastSync: Date | null;
  status: 'synced' | 'pending' | 'error' | 'out_of_sync';
  syncDirection: 'push' | 'pull' | 'bidirectional';
}

interface InventoryStats {
  totalRoomTypes: number;
  syncedCount: number;
  pendingCount: number;
  errorCount: number;
  lastGlobalSync: Date | null;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'synced':
      return <Check className="h-4 w-4 text-emerald-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-amber-500" />;
    case 'error':
      return <X className="h-4 w-4 text-red-500" />;
    case 'out_of_sync':
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    default:
      return <Minus className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    synced: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    out_of_sync: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return styles[status] || 'bg-gray-100 text-gray-700';
};

export default function InventorySync() {
  const [syncData, setSyncData] = useState<SyncStatus[]>([]);
  const [stats, setStats] = useState<InventoryStats>({
    totalRoomTypes: 0,
    syncedCount: 0,
    pendingCount: 0,
    errorCount: 0,
    lastGlobalSync: null,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/channels/inventory-sync');
      const result = await response.json();
      if (result.success) {
        setSyncData(result.data);
        setStats(result.stats);
      } else {
        toast.error('Failed to load inventory sync status');
      }
    } catch (error) {
      console.error('Error fetching inventory sync:', error);
      toast.error('Failed to load inventory sync status');
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
      const response = await fetch('/api/channel-manager/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all' }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Inventory sync initiated for all channels');
        fetchData();
      } else {
        toast.error(result.error?.message || 'Sync failed');
      }
    } catch {
      toast.error('Failed to connect to sync service');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncChannel = async (channelName: string) => {
    try {
      const response = await fetch('/api/channel-manager/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-channel', channelName }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`Syncing inventory for ${channelName}`);
        fetchData();
      } else {
        toast.error(result.error?.message || 'Sync failed');
      }
    } catch {
      toast.error('Failed to connect to sync service');
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
  const groupedByChannel = syncData.reduce((acc, item) => {
    const key = item.channelName;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, SyncStatus[]>);

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
          <h1 className="text-2xl font-bold tracking-tight">Inventory Sync</h1>
          <p className="text-muted-foreground">Monitor room availability across all channels</p>
        </div>
        <Button onClick={handleSyncAll} disabled={syncing}>
          {syncing ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sync All
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <Package className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalRoomTypes}</p>
                <p className="text-xs text-muted-foreground">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.syncedCount}</p>
                <p className="text-xs text-muted-foreground">Synced</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <X className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.errorCount}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Zap className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.totalRoomTypes > 0 
                    ? Math.round((stats.syncedCount / stats.totalRoomTypes) * 100) 
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Sync Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channel Cards */}
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
                    <Badge variant="outline">{items.length} room types</Badge>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleSyncChannel(channelName)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Sync
                  </Button>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Sync Progress</span>
                      <span className="font-medium">{syncProgress}%</span>
                    </div>
                    <Progress value={syncProgress} className="h-2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room Type</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead>Direction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.roomType}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.available}</span>
                            <span className="text-muted-foreground">/ {item.total}</span>
                            {item.available < item.total && (
                              <TrendingDown className="h-3 w-3 text-amber-500" />
                            )}
                            {item.available === item.total && (
                              <TrendingUp className="h-3 w-3 text-emerald-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(item.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(item.status)}
                              {item.status.replace('_', ' ')}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatLastSync(item.lastSync)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {item.syncDirection === 'bidirectional' ? '↔ Bidirectional' : 
                             item.syncDirection === 'push' ? '→ Push' : '← Pull'}
                          </Badge>
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
    </div>
  );
}
