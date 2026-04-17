'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Play,
  Pause,
  Copy,
  MoreHorizontal,
  Target,
  DollarSign,
  TrendingUp,
  Eye,
  MousePointer,
  ShoppingCart,
  Calendar,
  Loader2,
  Settings,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useCurrency } from '@/contexts/CurrencyContext';

interface AdCampaign {
  id: string;
  name: string;
  description: string | null;
  type: string;
  platform: string;
  status: string;
  budget: number;
  budgetType: string;
  spentAmount: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  bidStrategy: string;
  bidAmount: number | null;
  targetCpa: number | null;
  targetRoas: number | null;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  roas: number;
  createdAt: string;
  updatedAt: string;
}

interface CampaignStats {
  total: number;
  active: number;
  paused: number;
  totalBudget: number;
  totalSpent: number;
}

const campaignTypes = [
  { value: 'search', label: 'Search Ads' },
  { value: 'display', label: 'Display Ads' },
  { value: 'metasearch', label: 'Metasearch' },
  { value: 'social', label: 'Social Ads' },
];

const platforms = [
  { value: 'google', label: 'Google' },
  { value: 'meta', label: 'Meta (Facebook/Instagram)' },
  { value: 'tripadvisor', label: 'TripAdvisor' },
  { value: 'trivago', label: 'Trivago' },
];

const statusColors: Record<string, string> = {
  draft: 'bg-gradient-to-r from-gray-500 to-gray-400 text-white',
  active: 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white',
  paused: 'bg-gradient-to-r from-amber-500 to-amber-400 text-white',
  completed: 'bg-gradient-to-r from-blue-500 to-blue-400 text-white',
  archived: 'bg-gradient-to-r from-gray-500 to-gray-400 text-white',
};

const platformColors: Record<string, string> = {
  google: 'bg-gradient-to-r from-blue-500 to-blue-400 text-white',
  meta: 'bg-gradient-to-r from-violet-500 to-violet-400 text-white',
  tripadvisor: 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white',
  trivago: 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-white',
};

export default function AdCampaigns() {
  const { formatCurrency } = useCurrency();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [stats, setStats] = useState<CampaignStats>({
    total: 0,
    active: 0,
    paused: 0,
    totalBudget: 0,
    totalSpent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<AdCampaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'search',
    platform: 'google',
    budget: 100,
    budgetType: 'daily',
    bidStrategy: 'auto',
    bidAmount: null as number | null,
    targetCpa: null as number | null,
    targetRoas: null as number | null,
    startDate: '',
    endDate: '',
    targeting: '{}',
    keywords: '[]',
  });

  useEffect(() => {
    fetchCampaigns();
  }, [search, statusFilter, platformFilter]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (platformFilter !== 'all') params.append('platform', platformFilter);

      const response = await fetch(`/api/ads/campaigns?${params}`);
      const data = await response.json();

      if (data.success) {
        setCampaigns(data.data.campaigns);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (campaign?: AdCampaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setFormData({
        name: campaign.name,
        description: campaign.description || '',
        type: campaign.type,
        platform: campaign.platform,
        budget: campaign.budget,
        budgetType: campaign.budgetType,
        bidStrategy: campaign.bidStrategy,
        bidAmount: campaign.bidAmount,
        targetCpa: campaign.targetCpa,
        targetRoas: campaign.targetRoas,
        startDate: campaign.startDate ? new Date(campaign.startDate).toISOString().split('T')[0] : '',
        endDate: campaign.endDate ? new Date(campaign.endDate).toISOString().split('T')[0] : '',
        targeting: '{}',
        keywords: '[]',
      });
    } else {
      setEditingCampaign(null);
      setFormData({
        name: '',
        description: '',
        type: 'search',
        platform: 'google',
        budget: 100,
        budgetType: 'daily',
        bidStrategy: 'auto',
        bidAmount: null,
        targetCpa: null,
        targetRoas: null,
        startDate: '',
        endDate: '',
        targeting: '{}',
        keywords: '[]',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Campaign name is required');
      return;
    }

    setSaving(true);
    try {
      const url = '/api/ads/campaigns';
      const method = editingCampaign ? 'PUT' : 'POST';
      const body = editingCampaign
        ? { id: editingCampaign.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(editingCampaign ? 'Campaign updated' : 'Campaign created');
        setDialogOpen(false);
        fetchCampaigns();
      } else {
        toast.error(data.error?.message || 'Failed to save campaign');
      }
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast.error('Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const response = await fetch('/api/ads/campaigns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Campaign ${newStatus === 'active' ? 'activated' : newStatus}`);
        fetchCampaigns();
      } else {
        toast.error(data.error?.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteCampaignId(id);
  };

  const confirmDelete = async () => {
    if (!deleteCampaignId) return;

    try {
      const response = await fetch(`/api/ads/campaigns?id=${deleteCampaignId}`, { method: 'DELETE' });
      const data = await response.json();

      if (data.success) {
        toast.success('Campaign deleted');
        fetchCampaigns();
      } else {
        toast.error(data.error?.message || 'Failed to delete campaign');
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign');
    } finally {
      setDeleteCampaignId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
    return format(new Date(dateStr), 'MMM dd, yyyy');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Ad Campaigns</h2>
          <p className="text-muted-foreground">
            Create and manage advertising campaigns
          </p>
        </div>
        <Button className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md hover:shadow-lg transition-all" onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-emerald-50 dark:bg-emerald-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Active</p>
                <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{stats.active}</p>
              </div>
              <Play className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-amber-50 dark:bg-amber-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Paused</p>
                <p className="text-xl font-bold text-amber-900 dark:text-amber-100">{stats.paused}</p>
              </div>
              <Pause className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-violet-50 dark:bg-violet-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-violet-700 dark:text-violet-400">Budget</p>
                <p className="text-xl font-bold text-violet-900 dark:text-violet-100">{formatCurrency(stats.totalBudget)}</p>
              </div>
              <DollarSign className="h-5 w-5 text-violet-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-cyan-50 dark:bg-cyan-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-cyan-700 dark:text-cyan-400">Spent</p>
                <p className="text-xl font-bold text-cyan-900 dark:text-cyan-100">{formatCurrency(stats.totalSpent)}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-cyan-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 rounded-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {platforms.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns found</h3>
            <p className="text-muted-foreground mb-4">
              {search || statusFilter !== 'all' || platformFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first campaign to get started'}
            </p>
            <Button onClick={() => handleOpenDialog()} className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md hover:shadow-lg transition-all">
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="border-0 shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
                  <div className="flex gap-4">
                    <div className={`rounded-lg p-3 h-fit ${
                      campaign.status === 'active'
                        ? 'bg-emerald-100 dark:bg-emerald-900'
                        : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      <Target className={`h-5 w-5 ${
                        campaign.status === 'active'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-500'
                      }`} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{campaign.name}</h3>
                        <Badge className={statusColors[campaign.status]}>
                          {campaign.status}
                        </Badge>
                        <Badge variant="outline" className={cn('capitalize', platformColors[campaign.platform] || '')}>{campaign.platform}</Badge>
                      </div>
                      {campaign.description && (
                        <p className="text-sm text-muted-foreground">{campaign.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {formatCurrency(campaign.budget)}/{campaign.budgetType}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(campaign.startDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="flex gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-semibold">{campaign.impressions.toLocaleString()}</p>
                      <p className="text-muted-foreground text-xs">Impressions</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-amber-600">{campaign.clicks.toLocaleString()}</p>
                      <p className="text-muted-foreground text-xs">Clicks</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-emerald-600">{campaign.ctr.toFixed(2)}%</p>
                      <p className="text-muted-foreground text-xs">CTR</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-violet-600">{campaign.conversions}</p>
                      <p className="text-muted-foreground text-xs">Conversions</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-cyan-600">{formatCurrency(campaign.revenue)}</p>
                      <p className="text-muted-foreground text-xs">Revenue</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{campaign.roas.toFixed(2)}x</p>
                      <p className="text-muted-foreground text-xs">ROAS</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {campaign.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(campaign.id, 'paused')}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </Button>
                    ) : campaign.status === 'paused' || campaign.status === 'draft' ? (
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg transition-all"
                        onClick={() => handleStatusChange(campaign.id, 'active')}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Activate
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(campaign)}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => handleDelete(campaign.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Budget Progress */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Budget Used</span>
                    <span>{formatCurrency(campaign.spentAmount)} / {formatCurrency(campaign.budget)}</span>
                  </div>
                  <Progress value={(campaign.spentAmount / campaign.budget) * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle>
            <DialogDescription>
              Configure your advertising campaign
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-medium">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Summer Promotion 2024"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select
                      value={formData.platform}
                      onValueChange={(v) => setFormData({ ...formData, platform: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {platforms.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Campaign Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v) => setFormData({ ...formData, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {campaignTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Budget & Bidding */}
              <div className="space-y-4">
                <h4 className="font-medium">Budget & Bidding</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Budget</Label>
                    <Input
                      type="number"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Budget Type</Label>
                    <Select
                      value={formData.budgetType}
                      onValueChange={(v) => setFormData({ ...formData, budgetType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="lifetime">Lifetime</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bid Strategy</Label>
                    <Select
                      value={formData.bidStrategy}
                      onValueChange={(v) => setFormData({ ...formData, bidStrategy: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Automatic</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="enhanced">Enhanced CPC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Bid Amount (optional)</Label>
                    <Input
                      type="number"
                      value={formData.bidAmount || ''}
                      onChange={(e) => setFormData({ ...formData, bidAmount: parseFloat(e.target.value) || null })}
                      placeholder="Manual bid amount"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target CPA (optional)</Label>
                    <Input
                      type="number"
                      value={formData.targetCpa || ''}
                      onChange={(e) => setFormData({ ...formData, targetCpa: parseFloat(e.target.value) || null })}
                      placeholder="Cost per acquisition"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Target ROAS (optional)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.targetRoas || ''}
                      onChange={(e) => setFormData({ ...formData, targetRoas: parseFloat(e.target.value) || null })}
                      placeholder="Return on ad spend"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Schedule */}
              <div className="space-y-4">
                <h4 className="font-medium">Schedule</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md hover:shadow-lg transition-all">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCampaign ? 'Save Changes' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCampaignId} onOpenChange={(open) => !open && setDeleteCampaignId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
