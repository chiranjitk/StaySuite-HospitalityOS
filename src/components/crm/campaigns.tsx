'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Mail, MessageSquare, Bell, Send, Plus, Search, Edit, Trash2, 
  Calendar, Users, Eye, MousePointer, Clock, CheckCircle, XCircle,
  BarChart3, Copy, MoreHorizontal, Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  type: string;
  subject: string | null;
  content: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  openRate: number;
  clickRate: number;
  createdAt: string;
  segments: Array<{
    segment: {
      id: string;
      name: string;
      memberCount: number;
    };
  }>;
}

interface CampaignStats {
  total: number;
  draft: number;
  scheduled: number;
  sent: number;
  totalRecipients: number;
  totalSent: number;
  avgOpenRate: number;
  avgClickRate: number;
}

interface Segment {
  id: string;
  name: string;
  memberCount: number;
}

const campaignTypes = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
  { value: 'push', label: 'Push Notification', icon: Bell },
  { value: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
];

const statusColors: Record<string, string> = {
  draft: 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 dark:from-gray-800 dark:to-gray-700 dark:text-gray-300',
  scheduled: 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 dark:from-blue-900 dark:to-blue-800 dark:text-blue-300',
  sending: 'bg-gradient-to-r from-cyan-100 to-cyan-200 text-cyan-800 dark:from-cyan-900 dark:to-cyan-800 dark:text-cyan-300',
  sent: 'bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 dark:from-emerald-900 dark:to-emerald-800 dark:text-emerald-300',
  cancelled: 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 dark:from-red-900 dark:to-red-800 dark:text-red-300',
};

const typeColors: Record<string, string> = {
  email: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
  sms: 'bg-gradient-to-r from-violet-500 to-violet-600 text-white',
  push: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white',
  whatsapp: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<CampaignStats>({
    total: 0, draft: 0, scheduled: 0, sent: 0,
    totalRecipients: 0, totalSent: 0, avgOpenRate: 0, avgClickRate: 0
  });
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [viewingCampaign, setViewingCampaign] = useState<Campaign | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'email',
    subject: '',
    content: '',
    segmentIds: [] as string[],
    scheduledAt: '',
  });

  useEffect(() => {
    fetchCampaigns();
    fetchSegments();
  }, [search, statusFilter, typeFilter]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter);

      const response = await fetch(`/api/campaigns?${params}`);
      const data = await response.json();

      if (data.success) {
        setCampaigns(data.data.campaigns);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast.error('Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchSegments = async () => {
    try {
      const response = await fetch('/api/segments');
      const data = await response.json();
      if (data.success) {
        setSegments(data.data.segments);
      }
    } catch (error) {
      console.error('Error fetching segments:', error);
    }
  };

  const handleOpenDialog = (campaign?: Campaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setFormData({
        name: campaign.name,
        description: campaign.description || '',
        type: campaign.type,
        subject: campaign.subject || '',
        content: campaign.content,
        segmentIds: campaign.segments.map(s => s.segment.id),
        scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString().slice(0, 16) : '',
      });
    } else {
      setEditingCampaign(null);
      setFormData({
        name: '',
        description: '',
        type: 'email',
        subject: '',
        content: '',
        segmentIds: [],
        scheduledAt: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCampaign(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.content) {
      toast.error('Name and content are required');
      return;
    }

    try {
      const url = '/api/campaigns';
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
        toast.success(editingCampaign ? 'Campaign updated successfully' : 'Campaign created successfully');
        handleCloseDialog();
        fetchCampaigns();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast.error('Failed to save campaign');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteItemId(id);
  };

  const confirmDelete = async () => {
    if (!deleteItemId) return;

    try {
      const response = await fetch(`/api/campaigns?id=${deleteItemId}`, { method: 'DELETE' });
      const data = await response.json();

      if (data.success) {
        toast.success('Campaign deleted successfully');
        fetchCampaigns();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign');
    } finally {
      setDeleteItemId(null);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const response = await fetch('/api/campaigns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Campaign status updated');
        fetchCampaigns();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast.error('Failed to update campaign');
    }
  };

  const toggleSegment = (segmentId: string) => {
    setFormData(prev => ({
      ...prev,
      segmentIds: prev.segmentIds.includes(segmentId)
        ? prev.segmentIds.filter(id => id !== segmentId)
        : [...prev.segmentIds, segmentId],
    }));
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = campaignTypes.find(t => t.value === type);
    return typeConfig?.icon || Mail;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Marketing Campaigns</h1>
        <p className="text-muted-foreground">
          Create and manage email, SMS, and push notification campaigns
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Campaigns</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
              <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Scheduled</p>
                <p className="text-xl font-bold">{stats.scheduled}</p>
              </div>
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Avg Open Rate</p>
                <p className="text-xl font-bold">{stats.avgOpenRate}%</p>
              </div>
              <Eye className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Avg Click Rate</p>
                <p className="text-xl font-bold">{stats.avgClickRate}%</p>
              </div>
              <MousePointer className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm focus-within:ring-2 focus-within:ring-primary/20 rounded-md">
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
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {campaignTypes.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200">
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns found</h3>
            <p className="text-muted-foreground mb-4">
              {search || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first campaign to get started'}
            </p>
            {!search && statusFilter === 'all' && typeFilter === 'all' && (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const TypeIcon = getTypeIcon(campaign.type);
            return (
              <Card key={campaign.id} className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                <CardContent className="p-3 sm:p-4 lg:p-6">
                  <div className="flex flex-col md:flex-row gap-3 sm:gap-4 md:items-start justify-between">
                    <div className="flex gap-4">
                      <div className={cn('rounded-lg p-3 h-fit', typeColors[campaign.type] || 'bg-emerald-100 dark:bg-emerald-900')}>
                        <TypeIcon className="h-5 w-5 text-current" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{campaign.name}</h3>
                          <Badge className={cn(statusColors[campaign.status], 'shadow-sm')}>
                            {campaign.status}
                          </Badge>
                        </div>
                        {campaign.subject && (
                          <p className="text-sm text-muted-foreground">{campaign.subject}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {campaign.totalRecipients} recipients
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(campaign.scheduledAt || campaign.createdAt)}
                          </span>
                        </div>
                        
                        {/* Target Segments */}
                        {campaign.segments.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {campaign.segments.map(s => (
                              <Badge key={s.segment.id} variant="outline" className="text-xs">
                                {s.segment.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats for sent campaigns */}
                    {campaign.status === 'sent' && (
                      <div className="flex gap-6 text-sm">
                        <div className="text-center">
                          <p className="font-semibold">{campaign.sentCount}</p>
                          <p className="text-muted-foreground">Sent</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">{campaign.openRate}%</p>
                          <p className="text-muted-foreground">Opened</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-cyan-600 dark:text-cyan-400">{campaign.clickRate}%</p>
                          <p className="text-muted-foreground">Clicked</p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {campaign.status === 'draft' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleOpenDialog(campaign)}>
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button size="sm" onClick={() => handleStatusChange(campaign.id, 'scheduled')}>
                            <Send className="h-4 w-4 mr-1" />
                            Send
                          </Button>
                        </>
                      )}
                      {campaign.status === 'scheduled' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setViewingCampaign(campaign)}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleStatusChange(campaign.id, 'draft')}>
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                      {campaign.status === 'sent' && (
                        <Button variant="outline" size="sm" onClick={() => setViewingCampaign(campaign)}>
                          <BarChart3 className="h-4 w-4 mr-1" />
                          Stats
                        </Button>
                      )}
                      {['draft', 'cancelled'].includes(campaign.status) && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(campaign.id)}>
                          <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle>
            <DialogDescription>
              Configure your marketing campaign details and target audience
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Campaign Name</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Summer Promotion 2024"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {campaignTypes.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            <div className="flex items-center gap-2">
                              <t.icon className="h-4 w-4" />
                              {t.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the campaign"
                  />
                </div>
              </div>

              <Separator />

              {/* Content */}
              <div className="space-y-4">
                {formData.type === 'email' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject Line</label>
                    <Input
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Email subject line"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Content</label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder={formData.type === 'email' ? 'Email body content...' : 'Message content...'}
                    rows={6}
                  />
                </div>
              </div>

              <Separator />

              {/* Target Segments */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Target Segments</h4>
                  <p className="text-sm text-muted-foreground">
                    Select segments to include in this campaign
                  </p>
                </div>

                {segments.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground border rounded-lg">
                    No segments available. Create segments first.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {segments.map(segment => (
                      <div
                        key={segment.id}
                        onClick={() => toggleSegment(segment.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          formData.segmentIds.includes(segment.id)
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                            : 'hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{segment.name}</span>
                          <span className="text-sm text-muted-foreground">{segment.memberCount} guests</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {formData.segmentIds.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Total recipients: {segments.filter(s => formData.segmentIds.includes(s.id)).reduce((acc, s) => acc + s.memberCount, 0)}
                  </p>
                )}
              </div>

              <Separator />

              {/* Schedule */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Schedule (Optional)</label>
                  <Input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to save as draft
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button variant="outline" onClick={handleSave}>
              {editingCampaign ? 'Save Draft' : 'Create Draft'}
            </Button>
            {!editingCampaign && formData.scheduledAt && (
              <Button onClick={handleSave} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200">
                Schedule Campaign
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Campaign Dialog */}
      <Dialog open={!!viewingCampaign} onOpenChange={() => setViewingCampaign(null)}>
        <DialogContent className="w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingCampaign?.name}</DialogTitle>
            <DialogDescription>
              Campaign performance and details
            </DialogDescription>
          </DialogHeader>

          {viewingCampaign && (
            <div className="space-y-6">
              {/* Stats Grid */}
              {viewingCampaign.status === 'sent' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{viewingCampaign.sentCount}</p>
                    <p className="text-sm text-muted-foreground">Sent</p>
                  </div>
                  <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{viewingCampaign.openedCount}</p>
                    <p className="text-sm text-muted-foreground">Opened ({viewingCampaign.openRate}%)</p>
                  </div>
                  <div className="text-center p-4 bg-cyan-50 dark:bg-cyan-950 rounded-lg">
                    <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{viewingCampaign.clickedCount}</p>
                    <p className="text-sm text-muted-foreground">Clicked ({viewingCampaign.clickRate}%)</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{viewingCampaign.bouncedCount}</p>
                    <p className="text-sm text-muted-foreground">Bounced</p>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              {viewingCampaign.status === 'sent' && viewingCampaign.totalRecipients > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Delivery Progress</span>
                    <span>{Math.round((viewingCampaign.sentCount / viewingCampaign.totalRecipients) * 100)}%</span>
                  </div>
                  <Progress value={(viewingCampaign.sentCount / viewingCampaign.totalRecipients) * 100} className="[&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-500" />
                </div>
              )}

              {/* Details */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <p className="capitalize">{viewingCampaign.type}</p>
                </div>
                {viewingCampaign.subject && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Subject</label>
                    <p>{viewingCampaign.subject}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Content</label>
                  <div className="mt-1 p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {viewingCampaign.content}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
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
