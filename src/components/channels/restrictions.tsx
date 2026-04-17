'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Lock,
  Unlock,
  Calendar,
  ArrowDownToLine,
  ArrowUpFromLine,
  Save,
  Edit,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Helper function to safely parse composite IDs
function parseCompositeId(id: string): { connectionId: string; roomTypeId: string } | null {
  const parts = id.split('-');
  if (parts.length < 2) {
    console.error('Invalid composite ID format:', id);
    return null;
  }
  return {
    connectionId: parts[0],
    roomTypeId: parts.slice(1).join('-'), // Handle roomTypeId that might contain dashes
  };
}

interface RestrictionItem {
  id: string;
  channelName: string;
  channelType: string;
  roomType: string;
  date: Date;
  minStay: number;
  maxStay: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  stopSell: boolean;
  status: 'active' | 'inactive' | 'error';
}

interface RestrictionStats {
  total: number;
  active: number;
  stopSell: number;
  cta: number;
  ctd: number;
}

export default function Restrictions() {
  const [restrictions, setRestrictions] = useState<RestrictionItem[]>([]);
  const [stats, setStats] = useState<RestrictionStats>({ total: 0, active: 0, stopSell: 0, cta: 0, ctd: 0 });
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<{ open: boolean; item: RestrictionItem | null }>({ open: false, item: null });
  const [editForm, setEditForm] = useState({
    minStay: 1,
    maxStay: null as number | null,
    closedToArrival: false,
    closedToDeparture: false,
    stopSell: false,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/channels/restrictions');
      const result = await response.json();
      
      if (result.success) {
        setRestrictions(result.data.map((r: RestrictionItem) => ({
          ...r,
          date: new Date(r.date),
        })));
        setStats(result.stats);
      } else {
        toast.error('Failed to load restrictions');
      }
    } catch (error) {
      console.error('Error fetching restrictions:', error);
      toast.error('Failed to load restrictions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleRestriction = async (id: string, field: keyof RestrictionItem, value: boolean) => {
    try {
      // Find the restriction to update
      const restriction = restrictions.find(r => r.id === id);
      if (!restriction) return;
      
      // Parse the composite ID safely
      const parsedId = parseCompositeId(id);
      if (!parsedId) {
        toast.error('Invalid restriction ID');
        return;
      }
      
      // Update via API
      await fetch('/api/channels/restrictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: parsedId.connectionId,
          roomTypeId: parsedId.roomTypeId,
          date: restriction.date,
          [field]: value,
        }),
      });
      
      setRestrictions(prev => prev.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      ));
      
      // Update stats
      setStats(prev => ({
        ...prev,
        stopSell: field === 'stopSell' ? (value ? prev.stopSell + 1 : prev.stopSell - 1) : prev.stopSell,
        cta: field === 'closedToArrival' ? (value ? prev.cta + 1 : prev.cta - 1) : prev.cta,
        ctd: field === 'closedToDeparture' ? (value ? prev.ctd + 1 : prev.ctd - 1) : prev.ctd,
      }));
      
      toast.success('Restriction updated');
    } catch {
      toast.error('Failed to update restriction');
    }
  };

  const handleEditRestriction = async () => {
    if (!editDialog.item) return;
    
    // Parse the composite ID safely
    const parsedId = parseCompositeId(editDialog.item.id);
    if (!parsedId) {
      toast.error('Invalid restriction ID');
      return;
    }
    
    try {
      await fetch('/api/channels/restrictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: parsedId.connectionId,
          roomTypeId: parsedId.roomTypeId,
          date: editDialog.item.date,
          minStay: editForm.minStay,
          maxStay: editForm.maxStay,
          closedToArrival: editForm.closedToArrival,
          closedToDeparture: editForm.closedToDeparture,
          stopSell: editForm.stopSell,
        }),
      });
      
      setRestrictions(prev => prev.map(item => 
        item.id === editDialog.item!.id 
          ? { ...item, ...editForm }
          : item
      ));
      
      toast.success('Restriction updated successfully');
      setEditDialog({ open: false, item: null });
    } catch {
      toast.error('Failed to update restriction');
    }
  };

  const openEditDialog = (item: RestrictionItem) => {
    setEditDialog({ open: true, item });
    setEditForm({
      minStay: item.minStay,
      maxStay: item.maxStay,
      closedToArrival: item.closedToArrival,
      closedToDeparture: item.closedToDeparture,
      stopSell: item.stopSell,
    });
  };

  // Group by channel
  const groupedByChannel = restrictions.reduce((acc, item) => {
    const key = item.channelName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, RestrictionItem[]>);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Channel Restrictions</h1>
          <p className="text-muted-foreground">Manage min stay, CTA, CTD, and stop-sell across channels</p>
        </div>
        <Button onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <Lock className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Rules</p>
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
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
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
                <p className="text-2xl font-bold">{stats.stopSell}</p>
                <p className="text-xs text-muted-foreground">Stop Sell</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <ArrowDownToLine className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.cta}</p>
                <p className="text-xs text-muted-foreground">CTA</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <ArrowUpFromLine className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.ctd}</p>
                <p className="text-xs text-muted-foreground">CTD</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Restrictions Table by Channel */}
      {Object.keys(groupedByChannel).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No restrictions configured</p>
            <p className="text-sm text-muted-foreground">Connect channels to configure restrictions</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByChannel).map(([channelName, items]) => (
            <Card key={channelName}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{channelName}</CardTitle>
                <CardDescription>{items.length} restriction rules configured</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Mobile Cards */}
                <div className="sm:hidden space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className={`p-3 rounded-lg border ${item.stopSell ? 'bg-red-50 dark:bg-red-950/20 border-red-200' : ''}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">{item.roomType}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(item.date, 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Min Stay</p>
                          <Badge variant="outline">{item.minStay} night{item.minStay > 1 ? 's' : ''}</Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Max Stay</p>
                          {item.maxStay ? (
                            <Badge variant="outline">{item.maxStay} nights</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">No limit</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">CTA</span>
                          <Switch checked={item.closedToArrival} onCheckedChange={(checked) => handleToggleRestriction(item.id, 'closedToArrival', checked)} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">CTD</span>
                          <Switch checked={item.closedToDeparture} onCheckedChange={(checked) => handleToggleRestriction(item.id, 'closedToDeparture', checked)} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Stop Sell</span>
                          <Switch checked={item.stopSell} onCheckedChange={(checked) => handleToggleRestriction(item.id, 'stopSell', checked)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop Table */}
                <div className="hidden sm:block">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Room Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Min Stay</TableHead>
                          <TableHead>Max Stay</TableHead>
                          <TableHead>CTA</TableHead>
                          <TableHead>CTD</TableHead>
                          <TableHead>Stop Sell</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id} className={item.stopSell ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                            <TableCell className="font-medium">{item.roomType}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {format(item.date, 'MMM dd, yyyy')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.minStay} night{item.minStay > 1 ? 's' : ''}</Badge>
                            </TableCell>
                            <TableCell>
                              {item.maxStay ? (
                                <Badge variant="outline">{item.maxStay} nights</Badge>
                              ) : (
                                <span className="text-muted-foreground">No limit</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={item.closedToArrival}
                                onCheckedChange={(checked) => handleToggleRestriction(item.id, 'closedToArrival', checked)}
                              />
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={item.closedToDeparture}
                                onCheckedChange={(checked) => handleToggleRestriction(item.id, 'closedToDeparture', checked)}
                              />
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={item.stopSell}
                                onCheckedChange={(checked) => handleToggleRestriction(item.id, 'stopSell', checked)}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(item)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, item: editDialog.item })}>
        <DialogContent className="w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Restriction</DialogTitle>
            <DialogDescription>
              {editDialog.item?.roomType} - {editDialog.item?.channelName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Stay (nights)</Label>
                <Input
                  type="number"
                  min={1}
                  value={editForm.minStay}
                  onChange={(e) => setEditForm({ ...editForm, minStay: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Maximum Stay (nights)</Label>
                <Input
                  type="number"
                  min={1}
                  value={editForm.maxStay || ''}
                  onChange={(e) => setEditForm({ ...editForm, maxStay: parseInt(e.target.value) || null })}
                  placeholder="No limit"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Closed to Arrival (CTA)</Label>
                  <p className="text-xs text-muted-foreground">Guests cannot check in on this date</p>
                </div>
                <Switch
                  checked={editForm.closedToArrival}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, closedToArrival: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Closed to Departure (CTD)</Label>
                  <p className="text-xs text-muted-foreground">Guests cannot check out on this date</p>
                </div>
                <Switch
                  checked={editForm.closedToDeparture}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, closedToDeparture: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Stop Sell</Label>
                  <p className="text-xs text-muted-foreground">Close inventory for this date</p>
                </div>
                <Switch
                  checked={editForm.stopSell}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, stopSell: checked })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, item: null })}>
              Cancel
            </Button>
            <Button onClick={handleEditRestriction}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
