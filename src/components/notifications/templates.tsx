'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileText, Plus, Edit, Copy, Trash2, Mail, MessageSquare, Bell, Smartphone, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'in_app';
  category: 'booking' | 'guest' | 'payment' | 'system' | 'marketing';
  subject?: string;
  body: string;
  variables: string[];
  status: 'active' | 'inactive';
  lastModified: string;
  usageCount: number;
}

const typeIcons = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
  in_app: Smartphone,
};

const typeColors = {
  email: 'from-cyan-500/20 to-teal-500/20',
  sms: 'from-green-500/20 to-emerald-500/20',
  push: 'from-amber-500/20 to-orange-500/20',
  in_app: 'from-violet-500/20 to-purple-500/20',
};

export default function Templates() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, emailTemplates: 0, totalSent: 0 });
  const [editTemplate, setEditTemplate] = useState<NotificationTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/notifications/templates');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data.templates);
        setStats(data.data.stats);
      }
    } catch (error) {
      toast.error('Failed to fetch notification templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editTemplate) return;

    try {
      const method = editTemplate.id && editTemplate.id !== '' ? 'PUT' : 'POST';
      const response = await fetch('/api/notifications/templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editTemplate),
      });

      if (response.ok) {
        const data = await response.json();
        if (method === 'POST') {
          setTemplates([...templates, data.data]);
          toast.success('Template created successfully');
        } else {
          fetchTemplates();
          toast.success('Template updated successfully');
        }
      }
    } catch {
      toast.error('Failed to save template');
    }
    setDialogOpen(false);
    setEditTemplate(null);
  };

  const handleDuplicate = async (template: NotificationTemplate) => {
    const newTemplate = {
      ...template,
      id: '',
      name: `${template.name} (Copy)`,
      lastModified: new Date().toISOString(),
      usageCount: 0,
    };
    
    try {
      const response = await fetch('/api/notifications/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates([...templates, data.data]);
        toast.success('Template duplicated');
      }
    } catch {
      toast.error('Failed to duplicate template');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/templates?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTemplates(templates.filter(t => t.id !== id));
        toast.success('Template deleted');
      }
    } catch {
      toast.error('Failed to delete template');
    }
  };

  const handleToggleStatus = async (id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) return;

    try {
      const response = await fetch('/api/notifications/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: template.status === 'active' ? 'inactive' : 'active' }),
      });

      if (response.ok) {
        setTemplates(templates.map(t => 
          t.id === id ? { ...t, status: t.status === 'active' ? 'inactive' : 'active' } : t
        ));
        toast.success('Template status updated');
      }
    } catch {
      toast.error('Failed to update template status');
    }
  };

  const filteredTemplates = filterType === 'all' 
    ? templates 
    : templates.filter(t => t.type === filterType);

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notification Templates</h2>
          <p className="text-muted-foreground">Manage email, SMS, push, and in-app notification templates</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditTemplate({ id: '', name: '', type: 'email', category: 'booking', body: '', variables: [], status: 'active', lastModified: new Date().toISOString(), usageCount: 0 })}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editTemplate?.id ? 'Edit Template' : 'Create Notification Template'}</DialogTitle>
              <DialogDescription>Configure your notification template</DialogDescription>
            </DialogHeader>
            {editTemplate && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Template Name</Label>
                    <Input
                      id="name"
                      value={editTemplate.name}
                      onChange={(e) => setEditTemplate({ ...editTemplate, name: e.target.value })}
                      placeholder="Template name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={editTemplate.type}
                      onValueChange={(v: any) => setEditTemplate({ ...editTemplate, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="push">Push Notification</SelectItem>
                        <SelectItem value="in_app">In-App</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={editTemplate.category}
                      onValueChange={(v: any) => setEditTemplate({ ...editTemplate, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="booking">Booking</SelectItem>
                        <SelectItem value="guest">Guest</SelectItem>
                        <SelectItem value="payment">Payment</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={editTemplate.status}
                      onValueChange={(v: any) => setEditTemplate({ ...editTemplate, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {editTemplate.type === 'email' && (
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      value={editTemplate.subject || ''}
                      onChange={(e) => setEditTemplate({ ...editTemplate, subject: e.target.value })}
                      placeholder="Email subject"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="body">Message Body</Label>
                  <Textarea
                    id="body"
                    value={editTemplate.body}
                    onChange={(e) => setEditTemplate({ ...editTemplate, body: e.target.value })}
                    placeholder="Use {{variable_name}} for dynamic content"
                    className="min-h-[150px]"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium">Available Variables:</p>
                  <p className="text-xs">{editTemplate.variables.length > 0 ? editTemplate.variables.join(', ') : 'Extract variables using {{variable_name}} format'}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveTemplate}>Save Template</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Templates</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Email Templates</CardDescription>
            <CardTitle className="text-2xl">{templates.filter(t => t.type === 'email').length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Sent</CardDescription>
            <CardTitle className="text-2xl">{stats.totalSent.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filterType} onValueChange={setFilterType}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="push">Push</TabsTrigger>
          <TabsTrigger value="in_app">In-App</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Templates Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => {
                const Icon = typeIcons[template.type];
                return (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${typeColors[template.type]} flex items-center justify-center`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          {template.subject && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{template.subject}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{template.type.replace('_', '-')}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{template.category}</TableCell>
                    <TableCell>
                      <Badge variant={template.status === 'active' ? 'default' : 'secondary'} className={template.status === 'active' ? 'bg-emerald-500' : ''}>
                        {template.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{template.usageCount.toLocaleString()}</TableCell>
                    <TableCell>{new Date(template.lastModified).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setPreviewTemplate(template); setPreviewOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDuplicate(template)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setEditTemplate(template); setDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500 dark:text-red-400" onClick={() => handleDelete(template.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
            <DialogDescription>Template Preview</DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              {previewTemplate.subject && (
                <div>
                  <Label className="text-muted-foreground">Subject</Label>
                  <p className="font-medium">{previewTemplate.subject}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Body</Label>
                <div className="mt-2 p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                  {previewTemplate.body}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Variables</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {previewTemplate.variables.map(v => (
                    <Badge key={v} variant="outline">{'{{' + v + '}}'}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
