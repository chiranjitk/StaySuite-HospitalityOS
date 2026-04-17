'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Globe,
  RefreshCw,
  Loader2,
  Plus,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Key,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

interface ReviewSource {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSync: string | null;
  totalReviews: number;
  avgRating: number | null;
  syncEnabled: boolean;
  apiKey?: string;
  apiUrl?: string;
  config?: Record<string, unknown>;
}

const sourceTypes = [
  {
    id: 'google',
    name: 'Google Reviews',
    icon: '🔍',
    description: 'Connect to Google My Business API',
    features: ['Auto-sync reviews', 'Respond directly', 'Star ratings'],
  },
  {
    id: 'booking_com',
    name: 'Booking.com',
    icon: '🏨',
    description: 'Connect to Booking.com Partner API',
    features: ['Guest reviews', 'Property ratings', 'Review responses'],
  },
  {
    id: 'tripadvisor',
    name: 'TripAdvisor',
    icon: '🦉',
    description: 'Connect to TripAdvisor API',
    features: ['Traveler reviews', 'Ratings', 'Photos'],
  },
  {
    id: 'expedia',
    name: 'Expedia',
    icon: '✈️',
    description: 'Connect to Expedia Partner Central',
    features: ['Guest feedback', 'Property reviews', 'Ratings'],
  },
  {
    id: 'airbnb',
    name: 'Airbnb',
    icon: '🏠',
    description: 'Connect to Airbnb API',
    features: ['Guest reviews', 'Host responses', 'Ratings'],
  },
];

// No mock data - all data comes from the API

export default function ReviewSources() {
  const [sources, setSources] = useState<ReviewSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialog, setAddDialog] = useState(false);
  const [configDialog, setConfigDialog] = useState(false);
  const [selectedSource, setSelectedSource] = useState<ReviewSource | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state for new source
  const [formData, setFormData] = useState({
    name: '',
    apiKey: '',
    apiUrl: '',
    propertyId: '',
    syncEnabled: true,
  });

  const fetchSources = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/reputation/aggregation?status=config');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.sources?.length > 0) {
          // Build review count lookup from reviewCounts
          const reviewCountMap: Record<string, { count: number; avgRating: number | null }> = {};
          if (data.data.reviewCounts) {
            for (const rc of data.data.reviewCounts) {
              reviewCountMap[rc.source] = { count: rc.count, avgRating: rc.avgRating };
            }
          }

          const mapped: ReviewSource[] = data.data.sources.map((s: {
            source: string;
            enabled: boolean;
            lastSync: string | null;
            configured: boolean;
          }) => {
            const typeInfo = sourceTypes.find(t => t.id === s.source);
            const reviewData = reviewCountMap[s.source];
            return {
              id: `${s.source}-${Date.now()}`,
              name: typeInfo ? typeInfo.name : `${s.source}`,
              type: s.source,
              status: s.enabled ? (s.configured ? 'connected' : 'pending') : 'disconnected',
              lastSync: s.lastSync,
              totalReviews: reviewData?.count || 0,
              avgRating: reviewData?.avgRating || null,
              syncEnabled: s.enabled,
            };
          });
          setSources(mapped);
        } else {
          setSources([]);
        }
      } else {
        setSources([]);
      }
    } catch (error) {
      console.error('Error fetching sources:', error);
      toast.error('Failed to load review sources');
      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleConnectSource = async () => {
    if (!selectedType || !formData.name) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/reputation/aggregation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: selectedType,
          config: { apiKey: formData.apiKey, apiUrl: formData.apiUrl },
          enabled: formData.syncEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to connect source');
      }

      const result = await response.json();
      
      const newSource: ReviewSource = {
        id: Date.now().toString(),
        name: formData.name,
        type: selectedType,
        status: 'pending',
        lastSync: null,
        totalReviews: 0,
        avgRating: null,
        syncEnabled: formData.syncEnabled,
        apiKey: formData.apiKey,
        apiUrl: formData.apiUrl,
      };

      setSources(prev => [...prev, newSource]);
      toast.success(result.message || 'Review source connected successfully');
      setAddDialog(false);
      resetForm();
    } catch (error) {
      console.error('Error connecting source:', error);
      toast.error('Failed to connect review source');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSync = async (sourceId: string, enabled: boolean) => {
    const source = sources.find(s => s.id === sourceId);
    if (!source) return;

    try {
      // Optimistic update
      setSources(prev =>
        prev.map(s =>
          s.id === sourceId ? { ...s, syncEnabled: enabled } : s
        )
      );

      // Persist to backend
      const response = await fetch('/api/reputation/aggregation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: source.type,
          enabled,
        }),
      });

      if (!response.ok) {
        // Revert optimistic update on failure
        setSources(prev =>
          prev.map(s =>
            s.id === sourceId ? { ...s, syncEnabled: !enabled } : s
          )
        );
        throw new Error('Failed to update sync setting');
      }

      toast.success(`Sync ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling sync:', error);
      toast.error('Failed to update sync setting');
    }
  };

  const handleSync = async (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId);
    if (!source) return;

    toast.info(`Starting sync for ${source.name}...`);
    
    try {
      const response = await fetch('/api/reputation/aggregation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: [source.type],
        }),
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      setSources(prev =>
        prev.map(s =>
          s.id === sourceId
            ? { ...s, lastSync: new Date().toISOString(), status: 'connected' }
            : s
        )
      );
      
      toast.success('Sync completed successfully');
    } catch (error) {
      console.error('Error syncing source:', error);
      toast.error('Sync failed. Please try again.');
    }
  };

  const handleDisconnect = async (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId);
    if (!source) return;

    try {
      const response = await fetch('/api/reputation/aggregation', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: source.type }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect source');
      }

      setSources(prev => prev.filter(s => s.id !== sourceId));
      toast.success('Review source disconnected');
      setConfigDialog(false);
    } catch (error) {
      console.error('Error disconnecting source:', error);
      toast.error('Failed to disconnect source');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      apiKey: '',
      apiUrl: '',
      propertyId: '',
      syncEnabled: true,
    });
    setSelectedType(null);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: React.ReactNode }> = {
      connected: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      disconnected: { color: 'bg-gray-100 text-gray-800', icon: <XCircle className="h-3 w-3 mr-1" /> },
      error: { color: 'bg-red-100 text-red-800', icon: <AlertCircle className="h-3 w-3 mr-1" /> },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" /> },
    };

    const { color, icon } = config[status] || config.disconnected;

    return (
      <Badge variant="secondary" className={color}>
        {icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getSourceIcon = (type: string) => {
    const source = sourceTypes.find(s => s.id === type);
    return source?.icon || '🌐';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Review Sources</h2>
          <p className="text-muted-foreground">
            Connect and manage external review platforms
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => fetchSources()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setAddDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Source
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Connected Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sources.filter(s => s.status === 'connected').length}
            </div>
            <p className="text-xs text-muted-foreground">of {sources.length} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sources.reduce((sum, s) => sum + s.totalReviews, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">From all sources</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const rated = sources.filter(s => s.avgRating !== null);
                if (rated.length === 0) return '—';
                return (rated.reduce((sum, s) => {
                  const r = s.avgRating ?? 0;
                  return sum + (s.type === 'booking_com' ? r / 2 : r);
                }, 0) / rated.length).toFixed(1);
              })()}
            </div>
            <p className="text-xs text-muted-foreground">Across platforms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {sources.some(s => s.syncEnabled) ? 'Active' : 'Inactive'}
            </div>
            <p className="text-xs text-muted-foreground">
              {sources.filter(s => s.syncEnabled).length} of {sources.length} syncing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connected Sources Table */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Sources</CardTitle>
          <CardDescription>
            Manage your connected review platforms and sync settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Sync</TableHead>
                <TableHead>Total Reviews</TableHead>
                <TableHead>Avg Rating</TableHead>
                <TableHead>Auto Sync</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getSourceIcon(source.type)}</span>
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-xs text-muted-foreground">{source.type.replace('_', '.')}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(source.status)}</TableCell>
                  <TableCell>
                    {source.lastSync ? (
                      <div className="text-sm">
                        {new Date(source.lastSync).toLocaleString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell>{source.totalReviews.toLocaleString()}</TableCell>
                  <TableCell>
                    {source.avgRating ? (
                      <Badge variant="outline">
                        {source.type === 'booking_com' ? `${source.avgRating}/10` : `${source.avgRating}★`}
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={source.syncEnabled}
                      onCheckedChange={(checked) => handleToggleSync(source.id, checked)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSync(source.id)}
                        disabled={source.status === 'pending'}
                      >
                        <RefreshCw className={`h-4 w-4 ${source.status === 'pending' ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedSource(source);
                          setConfigDialog(true);
                        }}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Available Platforms */}
      <Card>
        <CardHeader>
          <CardTitle>Available Platforms</CardTitle>
          <CardDescription>
            Connect to more review platforms to aggregate all your reviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sourceTypes.map((type) => {
              const isConnected = sources.some(s => s.type === type.id);
              return (
                <Card key={type.id} className={isConnected ? 'opacity-60' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{type.icon}</span>
                        <CardTitle className="text-base">{type.name}</CardTitle>
                      </div>
                      {isConnected && <Badge variant="secondary">Connected</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      {type.description}
                    </p>
                    <ul className="space-y-1 mb-4">
                      {type.features.map((feature, index) => (
                        <li key={index} className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={isConnected ? 'outline' : 'default'}
                      disabled={isConnected}
                      onClick={() => {
                        setSelectedType(type.id);
                        setFormData(prev => ({ ...prev, name: type.name }));
                        setAddDialog(true);
                      }}
                    >
                      {isConnected ? 'Already Connected' : 'Connect'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Source Dialog */}
      <Dialog open={addDialog} onOpenChange={(open) => { setAddDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Review Source</DialogTitle>
            <DialogDescription>
              Enter your API credentials to connect the review platform
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sourceType">Platform</Label>
              <div className="flex gap-2 flex-wrap">
                {sourceTypes.map((type) => (
                  <Button
                    key={type.id}
                    variant={selectedType === type.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedType(type.id)}
                  >
                    {type.icon} {type.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Connection Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Google Reviews - Hotel Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">
                <Key className="h-3 w-3 inline mr-1" />
                API Key
              </Label>
              <Input
                id="apiKey"
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Enter your API key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyId">Property/Location ID</Label>
              <Input
                id="propertyId"
                value={formData.propertyId}
                onChange={(e) => setFormData(prev => ({ ...prev, propertyId: e.target.value }))}
                placeholder="Your property ID on the platform"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="syncEnabled">Enable Auto-sync</Label>
              <Switch
                id="syncEnabled"
                checked={formData.syncEnabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, syncEnabled: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleConnectSource} disabled={!selectedType || !formData.name || submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Connect Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Dialog */}
      <Dialog open={configDialog} onOpenChange={setConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Source Configuration</DialogTitle>
            <DialogDescription>
              Manage settings for {selectedSource?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedSource && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getSourceIcon(selectedSource.type)}</span>
                <div>
                  <p className="font-medium">{selectedSource.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Status: {selectedSource.status}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Total Reviews</p>
                  <p className="text-2xl font-bold">{selectedSource.totalReviews}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Avg Rating</p>
                  <p className="text-2xl font-bold">{selectedSource.avgRating || '-'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="configApiKey">API Key</Label>
                <Input
                  id="configApiKey"
                  type="password"
                  value={selectedSource.apiKey || '••••••••••••'}
                  disabled
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Auto Sync</Label>
                <Switch
                  checked={selectedSource.syncEnabled}
                  onCheckedChange={(checked) => handleToggleSync(selectedSource.id, checked)}
                />
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={() => handleDisconnect(selectedSource.id)}
                >
                  Disconnect
                </Button>
                <Button variant="outline" onClick={() => handleSync(selectedSource.id)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
