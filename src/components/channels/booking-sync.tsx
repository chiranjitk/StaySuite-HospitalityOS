'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Calendar,
  Users,
  Download,
  Upload,
  AlertTriangle,
  ArrowRightLeft,
  Inbox,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';

interface BookingSyncItem {
  id: string;
  channelName: string;
  channelType: string;
  confirmationCode: string;
  externalRef: string;
  guestName: string;
  roomType: string;
  checkIn: Date;
  checkOut: Date;
  amount: number;
  currency: string;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
  syncDirection: 'inbound' | 'outbound';
  lastSync: Date;
}

interface BookingSyncStats {
  total: number;
  synced: number;
  pending: number;
  conflicts: number;
  errors: number;
  inbound: number;
  outbound: number;
}

export default function BookingSync() {
  const { formatCurrency } = useCurrency();
  const { formatDate } = useTimezone();
  const [bookingData, setBookingData] = useState<BookingSyncItem[]>([]);
  const [stats, setStats] = useState<BookingSyncStats>({ total: 0, synced: 0, pending: 0, conflicts: 0, errors: 0, inbound: 0, outbound: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/channels/booking-sync');
      const result = await response.json();
      
      if (result.success) {
        setBookingData(result.data.map((b: BookingSyncItem) => ({
          ...b,
          checkIn: new Date(b.checkIn),
          checkOut: new Date(b.checkOut),
          lastSync: new Date(b.lastSync),
        })));
        setStats(result.stats);
      } else {
        toast.error('Failed to load booking sync status');
      }
    } catch (error) {
      console.error('Error fetching booking sync:', error);
      toast.error('Failed to load booking sync status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSyncBooking = async (booking: BookingSyncItem) => {
    try {
      const response = await fetch('/api/channel-manager/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync-channel',
          channelName: booking.channelType,
        }),
      });
      const result = await response.json();

      if (result.success) {
        setBookingData(prev => prev.map(item =>
          item.id === booking.id ? { ...item, syncStatus: 'synced', lastSync: new Date() } : item
        ));
        toast.success(`Booking ${booking.confirmationCode} synced successfully`);
      } else {
        toast.error(result.error?.message || 'Failed to sync booking');
      }
    } catch {
      toast.error('Failed to connect to server');
    }
  };

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
      const channels = [...new Set(bookingData.map(b => b.channelType))];
      for (const channel of channels) {
        const channelResults = pushResult.data?.results || [];
        const matchedResult = channelResults.find(
          (r: { channel?: string; success: boolean }) => r.channel === channel
        );
        const logStatus = matchedResult?.success ? 'success' : 'failed';
        const errorMessage = matchedResult?.success ? undefined : matchedResult?.message || 'Sync failed';

        await fetch('/api/channels/sync-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId: channel,
            syncType: 'booking',
            direction: 'outbound',
            status: logStatus,
            errorMessage,
            recordsProcessed: bookingData.filter(b => b.channelType === channel).length,
          }),
        });
      }

      if (pushResult.success) {
        toast.success(pushResult.message || 'Booking sync initiated for all channels');
      } else {
        toast.error(pushResult.error?.message || 'Failed to sync bookings');
      }
      fetchData();
    } catch {
      toast.error('Failed to sync bookings');
    } finally {
      setSyncing(false);
    }
  };

  const handleResolveConflict = async (id: string) => {
    try {
      // Update booking status via API
      await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'confirmed',
        }),
      });
      
      setBookingData(prev => prev.map(item => 
        item.id === id ? { ...item, syncStatus: 'synced' } : item
      ));
      toast.success('Conflict resolved');
    } catch {
      toast.error('Failed to resolve conflict');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return <Badge className="bg-emerald-100 text-emerald-700"><Check className="h-3 w-3 mr-1" />Synced</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'conflict':
        return <Badge className="bg-orange-100 text-orange-700"><AlertTriangle className="h-3 w-3 mr-1" />Conflict</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700"><X className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const filteredBookings = bookingData.filter(booking => {
    if (activeTab === 'all') return true;
    if (activeTab === 'inbound') return booking.syncDirection === 'inbound';
    if (activeTab === 'outbound') return booking.syncDirection === 'outbound';
    if (activeTab === 'pending') return booking.syncStatus === 'pending';
    if (activeTab === 'conflicts') return booking.syncStatus === 'conflict';
    return true;
  });

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
          <h1 className="text-2xl font-bold tracking-tight">Booking Sync</h1>
          <p className="text-muted-foreground">Synchronize bookings across all channels</p>
        </div>
        <Button onClick={handleSyncAll} disabled={syncing}>
          {syncing ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sync All Bookings
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <Calendar className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Bookings</p>
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
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.conflicts}</p>
                <p className="text-xs text-muted-foreground">Conflicts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <ArrowRightLeft className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inbound}/{stats.outbound}</p>
                <p className="text-xs text-muted-foreground">In/Out</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Bookings</TabsTrigger>
          <TabsTrigger value="inbound">
            <Inbox className="h-4 w-4 mr-1" />
            Inbound
          </TabsTrigger>
          <TabsTrigger value="outbound">
            <Send className="h-4 w-4 mr-1" />
            Outbound
          </TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="conflicts" className="text-orange-600">
            Conflicts ({stats.conflicts})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredBookings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No bookings found</p>
                <p className="text-sm text-muted-foreground">
                  {activeTab === 'all' ? 'Bookings will appear here once synced' : `No ${activeTab} bookings`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead>Confirmation</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Room Type</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Check-out</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{booking.channelName}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{booking.confirmationCode}</span>
                              {booking.externalRef && (
                                <span className="text-xs text-muted-foreground">{booking.externalRef}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              {booking.guestName}
                            </div>
                          </TableCell>
                          <TableCell>{booking.roomType}</TableCell>
                          <TableCell>{formatDate(booking.checkIn)}</TableCell>
                          <TableCell>{formatDate(booking.checkOut)}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(booking.amount)}
                          </TableCell>
                          <TableCell>
                            {booking.syncDirection === 'inbound' ? (
                              <Badge variant="outline" className="text-cyan-600">
                                <Download className="h-3 w-3 mr-1" />
                                Inbound
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-purple-600">
                                <Upload className="h-3 w-3 mr-1" />
                                Outbound
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(booking.syncStatus)}</TableCell>
                          <TableCell>
                            {booking.syncStatus === 'conflict' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResolveConflict(booking.id)}
                              >
                                Resolve
                              </Button>
                            )}
                            {booking.syncStatus === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSyncBooking(booking)}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Sync
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
