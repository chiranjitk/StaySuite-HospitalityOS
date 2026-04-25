'use client';

/**
 * Web Categories Component
 *
 * Category-based content filtering with time-based schedule rules.
 * Two tabs: Categories | Schedule Rules
 * Categories: name, type, implementation (block/allow), enabled toggle
 * Schedules: per-category time-based rules (days, start/end time, action)
 *
 * Data source: /api/wifi/radius?action=web-categories-*, web-category-schedules-*
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Globe,
  Plus,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
  Search,
  ShieldBan,
  ShieldCheck,
  Clock,
  Calendar,
  List,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface WebCategory {
  id: string;
  name: string;
  type: 'preset' | 'custom';
  implementation: 'block' | 'allow';
  enabled: boolean;
  description?: string;
  createdAt?: string;
}

interface CategoryFormData {
  name: string;
  type: string;
  implementation: string;
  enabled: boolean;
  description: string;
}

interface ScheduleRule {
  id: string;
  categoryId: string;
  categoryName?: string;
  daysOfWeek: string; // "0,1,2,3,4" etc.
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  action: 'block' | 'allow';
  enabled: boolean;
}

interface ScheduleFormData {
  categoryId: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  action: string;
  enabled: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_CATEGORY_FORM: CategoryFormData = {
  name: '',
  type: 'custom',
  implementation: 'block',
  enabled: true,
  description: '',
};

const EMPTY_SCHEDULE_FORM: ScheduleFormData = {
  categoryId: '',
  daysOfWeek: ['1', '2', '3', '4', '5'], // Mon-Fri
  startTime: '09:00',
  endTime: '17:00',
  action: 'block',
  enabled: true,
};

// ─── Component ──────────────────────────────────────────────────────────────────

export default function WebCategories() {
  const { toast } = useToast();

  // Categories state
  const [categories, setCategories] = useState<WebCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categorySearch, setCategorySearch] = useState('');

  // Category dialog
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<WebCategory | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>(EMPTY_CATEGORY_FORM);

  // Schedule state
  const [schedules, setSchedules] = useState<ScheduleRule[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);

  // Schedule dialog
  const [schedDialogOpen, setSchedDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRule | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [deleteSchedId, setDeleteSchedId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormData>(EMPTY_SCHEDULE_FORM);

  // ─── Fetch Categories ───────────────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const res = await fetch('/api/wifi/radius?action=web-categories-list');
      const data = await res.json();
      if (data.success && data.data) {
        setCategories(Array.isArray(data.data) ? data.data : []);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error('Failed to fetch web categories:', error);
      setCategories([]);
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  // ─── Fetch Schedules ────────────────────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    setIsLoadingSchedules(true);
    try {
      const res = await fetch('/api/wifi/radius?action=web-category-schedules-list');
      const data = await res.json();
      if (data.success && data.data) {
        setSchedules(Array.isArray(data.data) ? data.data : []);
      } else {
        setSchedules([]);
      }
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
      setSchedules([]);
    } finally {
      setIsLoadingSchedules(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchSchedules();
  }, [fetchCategories, fetchSchedules]);

  // ─── Category CRUD ──────────────────────────────────────────────────────────

  const resetCategoryForm = () => {
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setEditingCategory(null);
  };

  const openCreateCategory = () => {
    resetCategoryForm();
    setCatDialogOpen(true);
  };

  const openEditCategory = (cat: WebCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      type: cat.type,
      implementation: cat.implementation,
      enabled: cat.enabled,
      description: cat.description || '',
    });
    setCatDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast({ title: 'Error', description: 'Category name is required', variant: 'destructive' });
      return;
    }
    setSavingCategory(true);
    try {
      const action = editingCategory ? 'web-categories-update' : 'web-categories-create';
      const body = {
        action,
        ...(editingCategory ? { id: editingCategory.id } : {}),
        name: categoryForm.name.trim(),
        type: categoryForm.type,
        implementation: categoryForm.implementation,
        enabled: categoryForm.enabled,
        description: categoryForm.description,
      };

      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Success', description: `Category ${editingCategory ? 'updated' : 'created'}` });
        setCatDialogOpen(false);
        resetCategoryForm();
        fetchCategories();
      } else {
        toast({ title: 'Error', description: typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save category', variant: 'destructive' });
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCatId) return;
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'web-categories-delete', id: deleteCatId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Success', description: 'Category deleted' });
        fetchCategories();
        fetchSchedules();
      } else {
        toast({ title: 'Error', description: typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleteCatId(null);
    }
  };

  const handleToggleCategory = async (cat: WebCategory) => {
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'web-categories-update', id: cat.id, enabled: !cat.enabled }),
      });
      const data = await res.json();
      if (data.success) {
        fetchCategories();
      } else {
        toast({ title: 'Error', description: typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to toggle', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle', variant: 'destructive' });
    }
  };

  // ─── Schedule CRUD ──────────────────────────────────────────────────────────

  const resetScheduleForm = () => {
    setScheduleForm(EMPTY_SCHEDULE_FORM);
    setEditingSchedule(null);
  };

  const openCreateSchedule = () => {
    resetScheduleForm();
    setSchedDialogOpen(true);
  };

  const openEditSchedule = (sched: ScheduleRule) => {
    setEditingSchedule(sched);
    setScheduleForm({
      categoryId: sched.categoryId,
      daysOfWeek: sched.daysOfWeek.split(',').filter(Boolean),
      startTime: sched.startTime,
      endTime: sched.endTime,
      action: sched.action,
      enabled: sched.enabled,
    });
    setSchedDialogOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleForm.categoryId) {
      toast({ title: 'Error', description: 'Category is required', variant: 'destructive' });
      return;
    }
    setSavingSchedule(true);
    try {
      const action = editingSchedule ? 'web-category-schedules-update' : 'web-category-schedules-create';
      const body = {
        action,
        ...(editingSchedule ? { id: editingSchedule.id } : {}),
        categoryId: scheduleForm.categoryId,
        daysOfWeek: scheduleForm.daysOfWeek.join(','),
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        action_type: scheduleForm.action,
        enabled: scheduleForm.enabled,
      };

      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Success', description: `Schedule rule ${editingSchedule ? 'updated' : 'created'}` });
        setSchedDialogOpen(false);
        resetScheduleForm();
        fetchSchedules();
      } else {
        toast({ title: 'Error', description: typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save schedule', variant: 'destructive' });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deleteSchedId) return;
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'web-category-schedules-delete', id: deleteSchedId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Success', description: 'Schedule rule deleted' });
        fetchSchedules();
      } else {
        toast({ title: 'Error', description: typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleteSchedId(null);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const filteredCategories = categories.filter(c => {
    if (categorySearch) {
      const q = categorySearch.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  const getCategoryName = (id: string) => {
    const cat = categories.find(c => c.id === id);
    return cat?.name || id;
  };

  const formatDays = (daysStr: string) => {
    const days = daysStr.split(',').filter(Boolean).map(Number);
    if (days.length === 7) return 'Every day';
    if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) return 'Weekdays';
    if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
    return days.map(d => DAY_NAMES[d]).join(', ');
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Web Categories
          </h2>
          <p className="text-sm text-muted-foreground">
            Category-based content filtering with time-based schedule rules
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchCategories(); fetchSchedules(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories" className="gap-1.5">
            <Tag className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="schedules" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            Schedule Rules
          </TabsTrigger>
        </TabsList>

        {/* ─── Categories Tab ──────────────────────────────────────────── */}
        <TabsContent value="categories" className="space-y-4">
          {/* Search + Add */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search categories..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Button size="sm" onClick={openCreateCategory}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </div>

          {/* Categories Table */}
          <Card>
            <CardContent className="p-0">
              {isLoadingCategories ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted/50 p-4 mb-3">
                    <Globe className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">No web categories</h3>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Create categories to organize content filtering rules
                  </p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Implementation</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCategories.map((cat) => (
                        <TableRow key={cat.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium text-sm">{cat.name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{cat.type}</Badge>
                          </TableCell>
                          <TableCell>
                            {cat.implementation === 'block' ? (
                              <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">
                                <ShieldBan className="h-3 w-3 mr-1" /> Block
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">
                                <ShieldCheck className="h-3 w-3 mr-1" /> Allow
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground max-w-[200px] truncate">{cat.description || '—'}</p>
                          </TableCell>
                          <TableCell>
                            <Switch checked={cat.enabled} onCheckedChange={() => handleToggleCategory(cat)} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditCategory(cat)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteCatId(cat.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Schedules Tab ────────────────────────────────────────────── */}
        <TabsContent value="schedules" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openCreateSchedule}>
              <Plus className="h-4 w-4 mr-2" />
              Add Schedule Rule
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingSchedules ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : schedules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted/50 p-4 mb-3">
                    <Calendar className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">No schedule rules</h3>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Add time-based rules to control when categories are blocked or allowed
                  </p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Time Range</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules.map((sched) => (
                        <TableRow key={sched.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium text-sm">{sched.categoryName || getCategoryName(sched.categoryId)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">{formatDays(sched.daysOfWeek)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-mono text-sm">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {sched.startTime} – {sched.endTime}
                            </div>
                          </TableCell>
                          <TableCell>
                            {sched.action === 'block' ? (
                              <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">
                                <ShieldBan className="h-3 w-3 mr-1" /> Block
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">
                                <ShieldCheck className="h-3 w-3 mr-1" /> Allow
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={sched.enabled ? 'default' : 'outline'} className="text-xs">
                              {sched.enabled ? 'Active' : 'Disabled'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditSchedule(sched)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteSchedId(sched.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Category Create/Edit Dialog ────────────────────────────────── */}
      <Dialog open={catDialogOpen} onOpenChange={(open) => { if (!open) resetCategoryForm(); setCatDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Web Category' : 'New Web Category'}</DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Update category settings' : 'Create a new content filtering category'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Category Name *</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Social Media"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={categoryForm.type} onValueChange={(v) => setCategoryForm(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preset">Preset</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Implementation</Label>
                <Select value={categoryForm.implementation} onValueChange={(v) => setCategoryForm(prev => ({ ...prev, implementation: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">Block</SelectItem>
                    <SelectItem value="allow">Allow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={categoryForm.description}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enabled</Label>
                <p className="text-xs text-muted-foreground">Activate this category for filtering</p>
              </div>
              <Switch checked={categoryForm.enabled} onCheckedChange={(checked) => setCategoryForm(prev => ({ ...prev, enabled: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetCategoryForm(); setCatDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleSaveCategory} disabled={savingCategory}>
              {savingCategory && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Schedule Create/Edit Dialog ────────────────────────────────── */}
      <Dialog open={schedDialogOpen} onOpenChange={(open) => { if (!open) resetScheduleForm(); setSchedDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Schedule Rule' : 'New Schedule Rule'}</DialogTitle>
            <DialogDescription>
              {editingSchedule ? 'Update time-based filtering rule' : 'Define when this category should be blocked or allowed'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={scheduleForm.categoryId} onValueChange={(v) => setScheduleForm(prev => ({ ...prev, categoryId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Days of Week</Label>
              <div className="flex flex-wrap gap-2">
                {DAY_NAMES.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Checkbox
                      checked={scheduleForm.daysOfWeek.includes(String(idx))}
                      onCheckedChange={(checked) => {
                        const days = checked
                          ? [...scheduleForm.daysOfWeek, String(idx)]
                          : scheduleForm.daysOfWeek.filter(d => d !== String(idx));
                        setScheduleForm(prev => ({ ...prev, daysOfWeek: days }));
                      }}
                    />
                    <span className="text-sm">{name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={scheduleForm.startTime}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={scheduleForm.endTime}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={scheduleForm.action} onValueChange={(v) => setScheduleForm(prev => ({ ...prev, action: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="block">Block</SelectItem>
                  <SelectItem value="allow">Allow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enabled</Label>
                <p className="text-xs text-muted-foreground">Activate this schedule rule</p>
              </div>
              <Switch checked={scheduleForm.enabled} onCheckedChange={(checked) => setScheduleForm(prev => ({ ...prev, enabled: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetScheduleForm(); setSchedDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleSaveSchedule} disabled={savingSchedule}>
              {savingSchedule && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSchedule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Category Confirmation ───────────────────────────────── */}
      <AlertDialog open={!!deleteCatId} onOpenChange={(open) => { if (!open) setDeleteCatId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this web category and its associated schedule rules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Schedule Confirmation ───────────────────────────────── */}
      <AlertDialog open={!!deleteSchedId} onOpenChange={(open) => { if (!open) setDeleteSchedId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule Rule</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this time-based filtering rule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSchedule} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
