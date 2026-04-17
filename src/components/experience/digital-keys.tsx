'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Key,
  Smartphone,
  RefreshCw,
  Lock,
  Unlock,
  Clock,
  Users,
  AlertCircle,
  CheckCircle2,
  Copy,
  QrCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useUIStore } from '@/store';
import { format, formatDistanceToNow } from 'date-fns';

interface DigitalKey {
  id: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  guestName: string;
  bookingCode: string;
  checkIn: string;
  checkOut: string;
  keyEnabled: boolean;
  keySecret?: string;
  lastAccess?: string | null;
  accessCount: number;
  status: 'active' | 'expired' | 'pending' | 'disabled';
}

export default function DigitalKeys() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<DigitalKey[]>([]);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<DigitalKey | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    expired: 0,
    totalAccess: 0,
  });

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (result.success) {
          setProperties(result.data);
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, []);

  // Fetch digital keys
  const fetchKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPropertyId !== 'all') {
        params.append('propertyId', selectedPropertyId);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const queryString = params.toString();
      const response = await fetch(`/api/digital-keys${queryString ? `?${queryString}` : ''}`);
      const result = await response.json();

      if (result.success) {
        setKeys(result.data);
        setStats(result.stats);
      } else {
        throw new Error(result.error?.message || 'Failed to fetch digital keys');
      }
    } catch (error) {
      console.error('Error fetching digital keys:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch digital keys',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedPropertyId, statusFilter, toast]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Toggle key status
  const toggleKeyStatus = async (roomId: string, enabled: boolean) => {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/digital-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          keyEnabled: enabled,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: enabled ? 'Key Activated' : 'Key Deactivated',
          description: enabled
            ? 'Digital key has been enabled for the guest'
            : 'Digital key has been disabled',
        });
        fetchKeys();
        if (selectedKey?.roomId === roomId) {
          setSelectedKey((prev) =>
            prev ? { ...prev, keyEnabled: enabled, status: enabled ? 'active' : 'disabled' } : null
          );
        }
      } else {
        throw new Error(result.error?.message || 'Failed to update key');
      }
    } catch (error) {
      console.error('Error updating key:', error);
      toast({
        title: 'Error',
        description: 'Failed to update key status',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Copy key secret
  const copyKeySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast({
      title: 'Copied',
      description: 'Key code copied to clipboard',
    });
  };

  // Regenerate key
  const regenerateKey = async (roomId: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/digital-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          action: 'regenerate',
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Key Regenerated',
          description: 'A new digital key has been generated',
        });
        fetchKeys();
        if (selectedKey?.roomId === roomId) {
          setSelectedKey((prev) =>
            prev ? { ...prev, keySecret: result.data.keySecret } : null
          );
        }
      } else {
        throw new Error(result.error?.message || 'Failed to regenerate key');
      }
    } catch (error) {
      console.error('Error regenerating key:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate key',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      active: { label: 'Active', className: 'bg-emerald-500' },
      pending: { label: 'Pending', className: 'bg-amber-500' },
      expired: { label: 'Expired', className: 'bg-gray-500' },
      disabled: { label: 'Disabled', className: 'bg-red-500' },
    };
    const option = config[status];
    return (
      <Badge variant="secondary" className={cn('text-white', option?.className)}>
        {option?.label || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            Digital Keys
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage mobile key access for guest rooms
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Property" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => fetchKeys()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Unlock className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.active}</div>
              <div className="text-xs text-muted-foreground">Active Keys</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-500/10">
              <Lock className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.expired}</div>
              <div className="text-xs text-muted-foreground">Expired</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Users className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Guests</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Smartphone className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalAccess}</div>
              <div className="text-xs text-muted-foreground">Total Access</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Keys Grid */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Key className="h-12 w-12 mb-4" />
            <p>No digital keys found</p>
            <p className="text-sm">Keys will appear when guests have active bookings</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 pr-4">
            {keys.map((key) => (
              <Card key={key.id} className="overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                        <Key className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Room {key.roomNumber}</CardTitle>
                        <p className="text-xs text-muted-foreground">{key.roomType}</p>
                      </div>
                    </div>
                    {getStatusBadge(key.status)}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Guest:</span>
                      <span className="text-sm font-medium">{key.guestName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Stay:</span>
                      <span className="text-sm">
                        {format(new Date(key.checkIn), 'MMM d')} - {format(new Date(key.checkOut), 'MMM d')}
                      </span>
                    </div>
                    {key.keySecret && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Key Code:</span>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-2 py-1 rounded">{key.keySecret}</code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyKeySecret(key.keySecret!)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {key.accessCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Access Count:</span>
                        <Badge variant="outline">{key.accessCount} unlocks</Badge>
                      </div>
                    )}

                    <Separator className="my-2" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`key-${key.id}`}
                          checked={key.keyEnabled}
                          onCheckedChange={(checked) => toggleKeyStatus(key.roomId, checked)}
                          disabled={key.status === 'expired' || isUpdating}
                        />
                        <Label htmlFor={`key-${key.id}`} className="text-sm">
                          {key.keyEnabled ? 'Enabled' : 'Disabled'}
                        </Label>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedKey(key);
                          setIsDetailOpen(true);
                        }}
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Key Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Digital Key Details
            </DialogTitle>
          </DialogHeader>
          {selectedKey && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-lg">Room {selectedKey.roomNumber}</h3>
                  <p className="text-sm text-muted-foreground">{selectedKey.roomType} - Floor {selectedKey.floor}</p>
                </div>
                {getStatusBadge(selectedKey.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Guest</p>
                  <p className="font-medium">{selectedKey.guestName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Booking</p>
                  <p className="font-medium">{selectedKey.bookingCode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Check-in</p>
                  <p>{format(new Date(selectedKey.checkIn), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Check-out</p>
                  <p>{format(new Date(selectedKey.checkOut), 'MMM d, yyyy')}</p>
                </div>
              </div>

              {selectedKey.keySecret && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Key Code</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => regenerateKey(selectedKey.roomId)}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-lg font-mono">{selectedKey.keySecret}</code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyKeySecret(selectedKey.keySecret!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {selectedKey.accessCount > 0 && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{selectedKey.accessCount}</p>
                    <p className="text-xs text-muted-foreground">Total Access</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      {selectedKey.lastAccess
                        ? formatDistanceToNow(new Date(selectedKey.lastAccess), { addSuffix: true })
                        : 'Never'}
                    </p>
                    <p className="text-xs text-muted-foreground">Last Access</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="detail-key-toggle"
                    checked={selectedKey.keyEnabled}
                    onCheckedChange={(checked) => {
                      toggleKeyStatus(selectedKey.roomId, checked);
                      setSelectedKey((prev) =>
                        prev ? { ...prev, keyEnabled: checked, status: checked ? 'active' : 'disabled' } : null
                      );
                    }}
                    disabled={selectedKey.status === 'expired' || isUpdating}
                  />
                  <Label htmlFor="detail-key-toggle">
                    {selectedKey.keyEnabled ? 'Key Enabled' : 'Key Disabled'}
                  </Label>
                </div>
                <Button variant="outline" size="sm" onClick={() => useUIStore.getState().setActiveSection('experience-app-controls')}>
                  <QrCode className="h-4 w-4 mr-2" />
                  QR Code
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
