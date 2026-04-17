'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ClipboardCheck,
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  BarChart3,
  Users,
  Home,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Loader2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Star,
  CalendarDays,
  Clock,
  MapPin,
  AlertTriangle,
  Award,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

// ──────────────── Interfaces ────────────────

interface TemplateItem {
  id: string;
  name: string;
  category: string;
  required: boolean;
  sortOrder: number;
}

interface InspectionTemplate {
  id: string;
  name: string;
  description: string | null;
  roomType: string | null;
  category: string;
  items: string; // JSON string
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  propertyId: string | null;
}

interface InspectionItem {
  templateItemId: string;
  name: string;
  passed: boolean;
  required: boolean;
  notes?: string;
  photoUrl?: string;
}

interface InspectionResult {
  id: string;
  propertyId: string;
  roomId: string;
  templateId: string;
  inspectorId: string;
  score: number;
  passed: boolean;
  items: string;
  notes: string | null;
  reAssigned: boolean;
  completedAt: string;
  template: { id: string; name: string; category: string } | null;
  inspector: { id: string; firstName: string; lastName: string; avatar: string | null } | null;
  room?: {
    id: string;
    number: string;
    floor: number;
    roomType: { id: string; name: string } | null;
  } | null;
}

interface InspectionDetail {
  id: string;
  propertyId: string;
  roomId: string;
  templateId: string;
  inspectorId: string;
  score: number;
  passed: boolean;
  items: string;
  notes: string | null;
  reAssigned: boolean;
  completedAt: string;
  template: { id: string; name: string; category: string; items: string } | null;
  room: {
    id: string;
    number: string;
    floor: number;
    housekeepingStatus: string;
    roomType: { id: string; name: string } | null;
  } | null;
  inspector: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    jobTitle: string | null;
  } | null;
}

interface InspectorStat {
  inspectorId: string;
  inspectorName: string;
  totalInspections: number;
  avgScore: number;
  passRate: number;
}

interface RoomStat {
  roomId: string;
  roomNumber: string;
  lastScore: number;
  lastInspectedAt: string;
}

interface TrendDataPoint {
  date: string;
  avgScore: number;
  totalInspections: number;
  passRate: number;
}

interface Property {
  id: string;
  name: string;
}

interface Room {
  id: string;
  number: string;
  floor: number;
  housekeepingStatus: string;
  roomType: { id: string; name: string } | null;
}

// ──────────────── Constants ────────────────

const ROOM_TYPES = [
  { value: '', label: 'All Room Types' },
  { value: 'standard', label: 'Standard' },
  { value: 'suite', label: 'Suite' },
  { value: 'vip', label: 'VIP' },
  { value: 'deluxe', label: 'Deluxe' },
  { value: 'deep_clean', label: 'Deep Clean' },
  { value: 'public_area', label: 'Public Area' },
];

// Mapping from shorthand template roomType values to keywords
// used for flexible matching against actual room type names
const ROOM_TYPE_KEYWORDS: Record<string, string[]> = {
  standard: ['standard'],
  suite: ['suite'],
  vip: ['vip', 'presidential', 'executive', 'penthouse'],
  deluxe: ['deluxe'],
  deep_clean: [],
  public_area: [],
};

/**
 * Flexible room type matching.
 * Handles mismatch between shorthand template values ("standard", "vip")
 * and actual DB room type names ("Standard Room", "Presidential Suite").
 */
function roomTypeMatches(templateRoomType: string | null | undefined, actualRoomTypeName: string): boolean {
  if (!templateRoomType) return true; // template applies to all room types
  const tpl = templateRoomType.toLowerCase().replace(/[_-]/g, ' ');
  const actual = actualRoomTypeName.toLowerCase();
  // Exact match
  if (tpl === actual) return true;
  // Substring match (e.g. "standard" in "standard room")
  if (actual.includes(tpl) || tpl.includes(actual)) return true;
  // Keyword match for known shorthand values
  const keywords = ROOM_TYPE_KEYWORDS[templateRoomType.toLowerCase()];
  if (keywords) {
    const actualNorm = actual.replace(/\s+/g, '');
    for (const kw of keywords) {
      if (actual.includes(kw) || actualNorm.includes(kw.replace(/\s+/g, ''))) return true;
    }
  }
  return false;
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'room', label: 'Room' },
  { value: 'public_area', label: 'Public Area' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'amenity', label: 'Amenity' },
];

const CATEGORY_COLORS: Record<string, string> = {
  room: 'bg-emerald-500',
  public_area: 'bg-teal-500',
  kitchen: 'bg-amber-500',
  amenity: 'bg-violet-500',
  bathroom: 'bg-cyan-500',
  bedroom: 'bg-rose-500',
};

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 70) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 70) return 'bg-amber-500';
  return 'bg-red-500';
}

function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function generateId(): string {
  return `item-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;
}

// ──────────────── Custom Scrollbar Style ────────────────
const scrollbarStyle = (
  <>
    <style>{`
      .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .custom-scroll::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
      .custom-scroll::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.3); border-radius: 3px; }
      .custom-scroll::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.5); }
    `}</style>
  </>
);

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function InspectionChecklists() {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      {scrollbarStyle}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-teal-600" />
            Inspection Checklists
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage templates, conduct inspections, and track quality across your property
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="templates" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="inspect" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Inspect Room</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Quality Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="inspect">
          <InspectTab />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 1: TEMPLATES MANAGEMENT
// ═══════════════════════════════════════════════════════════

function TemplatesTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<InspectionTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    roomType: '' as string,
    category: 'room',
    isActive: true,
    items: [] as TemplateItem[],
  });

  const [showPreview, setShowPreview] = useState(false);
  const [dbRoomTypes, setDbRoomTypes] = useState<{ id: string; name: string }[]>([]);

  // Fetch actual room types from DB for template form
  useEffect(() => {
    const fetchRoomTypes = async () => {
      try {
        const res = await fetch('/api/room-types?limit=100');
        const result = await res.json();
        if (result.success) setDbRoomTypes(result.data || []);
      } catch { /* fallback to hardcoded */ }
    };
    fetchRoomTypes();
  }, []);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (roomTypeFilter) params.append('roomType', roomTypeFilter);
      if (categoryFilter) params.append('category', categoryFilter);

      const response = await fetch(`/api/inspection-templates?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setTemplates(result.data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({ title: 'Error', description: 'Failed to fetch templates', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, roomTypeFilter, categoryFilter, toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTemplates();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchTemplates]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      roomType: '',
      category: 'room',
      isActive: true,
      items: [],
    });
    setShowPreview(false);
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: generateId(),
          name: '',
          category: prev.category || 'general',
          required: true,
          sortOrder: prev.items.length,
        },
      ],
    }));
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, sortOrder: i })),
    }));
  };

  const updateItem = (index: number, field: keyof TemplateItem, value: string | boolean | number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  const moveItemUp = (index: number) => {
    if (index === 0) return;
    setFormData((prev) => {
      const newItems = [...prev.items];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      return { ...prev, items: newItems.map((item, i) => ({ ...item, sortOrder: i })) };
    });
  };

  const moveItemDown = (index: number) => {
    if (index >= formData.items.length - 1) return;
    setFormData((prev) => {
      const newItems = [...prev.items];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      return { ...prev, items: newItems.map((item, i) => ({ ...item, sortOrder: i })) };
    });
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Template name is required', variant: 'destructive' });
      return;
    }
    if (formData.items.some((item) => !item.name.trim())) {
      toast({ title: 'Validation Error', description: 'All checklist items must have a name', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/inspection-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          roomType: formData.roomType || null,
          category: formData.category,
          items: formData.items,
          isActive: formData.isActive,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Template created successfully' });
        setIsCreateOpen(false);
        resetForm();
        fetchTemplates();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create template', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error creating template:', error);
      toast({ title: 'Error', description: 'Failed to create template', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedTemplate || !formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Template name is required', variant: 'destructive' });
      return;
    }
    if (formData.items.some((item) => !item.name.trim())) {
      toast({ title: 'Validation Error', description: 'All checklist items must have a name', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/inspection-templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          roomType: formData.roomType || null,
          category: formData.category,
          items: formData.items,
          isActive: formData.isActive,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Template updated successfully' });
        setIsEditOpen(false);
        setSelectedTemplate(null);
        resetForm();
        fetchTemplates();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to update template', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error updating template:', error);
      toast({ title: 'Error', description: 'Failed to update template', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/inspection-templates/${selectedTemplate.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: result.message || 'Template deleted successfully' });
        setIsDeleteOpen(false);
        setSelectedTemplate(null);
        fetchTemplates();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to delete template', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({ title: 'Error', description: 'Failed to delete template', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (template: InspectionTemplate) => {
    const items = parseJson<TemplateItem[]>(template.items, []);
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      roomType: template.roomType || '',
      category: template.category,
      isActive: template.isActive,
      items,
    });
    setIsEditOpen(true);
  };

  // Stats
  const totalTemplates = templates.length;
  const activeTemplates = templates.filter((t) => t.isActive).length;
  const avgItems =
    totalTemplates > 0
      ? Math.round(templates.reduce((sum, t) => sum + parseJson<TemplateItem[]>(t.items, []).length, 0) / totalTemplates)
      : 0;

  // Group items by category for preview
  const groupedPreview = useMemo(() => {
    const groups: Record<string, TemplateItem[]> = {};
    for (const item of formData.items) {
      const cat = item.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [formData.items]);

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <ClipboardList className="h-4 w-4 text-teal-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalTemplates}</div>
              <div className="text-xs text-muted-foreground">Total Templates</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeTemplates}</div>
              <div className="text-xs text-muted-foreground">Active Templates</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Star className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{avgItems}</div>
              <div className="text-xs text-muted-foreground">Avg Items/Template</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Bar + Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Room Type" />
              </SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map((rt) => (
                  <SelectItem key={rt.value || 'all'} value={rt.value || 'all'}>
                    {rt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value || 'all'} value={c.value || 'all'}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Template Cards Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center">
          <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-1">No Templates Found</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first inspection template to get started</p>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const items = parseJson<TemplateItem[]>(template.items, []);
            return (
              <Card key={template.id} className="p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{template.name}</h3>
                    {template.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedTemplate(template); setIsViewOpen(true); }}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditDialog(template)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                      onClick={() => { setSelectedTemplate(template); setIsDeleteOpen(true); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {template.roomType && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Home className="h-3 w-3" />
                      {template.roomType.replace('_', ' ')}
                    </Badge>
                  )}
                  <Badge variant="secondary" className={cn('text-white text-xs', CATEGORY_COLORS[template.category] || 'bg-gray-500')}>
                    {template.category.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {items.length} item{items.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-auto pt-2 border-t">
                  <Badge variant={template.isActive ? 'default' : 'secondary'} className={cn('text-xs', template.isActive ? 'bg-emerald-600 hover:bg-emerald-700' : '')}>
                    {template.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {template.createdAt ? formatDistanceToNow(new Date(template.createdAt), { addSuffix: true }) : ''}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create/Edit Template Dialog ── */}
      <TemplateFormDialog
        open={isCreateOpen || isEditOpen}
        onClose={() => { setIsCreateOpen(false); setIsEditOpen(false); setSelectedTemplate(null); resetForm(); }}
        onSave={isCreateOpen ? handleCreate : handleUpdate}
        formData={formData}
        setFormData={setFormData}
        addItem={addItem}
        removeItem={removeItem}
        updateItem={updateItem}
        moveItemUp={moveItemUp}
        moveItemDown={moveItemDown}
        showPreview={showPreview}
        setShowPreview={setShowPreview}
        groupedPreview={groupedPreview}
        isEdit={isEditOpen}
        dbRoomTypes={dbRoomTypes}
        isSaving={isSaving}
        title={isEditOpen ? 'Edit Template' : 'Create Template'}
      />

      {/* ── View Template Dialog ── */}
      <ViewTemplateDialog
        open={isViewOpen}
        onClose={() => { setIsViewOpen(false); setSelectedTemplate(null); }}
        template={selectedTemplate}
      />

      {/* ── Delete Confirmation ── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedTemplate?.name}&quot;?
              {selectedTemplate && parseJson<TemplateItem[]>(selectedTemplate.items, []).length > 0 && (
                <span className="block mt-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  If this template has been used in inspections, it will be deactivated instead of deleted.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Template Form Dialog (shared for create/edit) ──

function TemplateFormDialog({
  open,
  onClose,
  onSave,
  formData,
  setFormData,
  addItem,
  removeItem,
  updateItem,
  moveItemUp,
  moveItemDown,
  showPreview,
  setShowPreview,
  groupedPreview,
  isEdit,
  isSaving,
  title,
  dbRoomTypes,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  formData: { name: string; description: string; roomType: string; category: string; isActive: boolean; items: TemplateItem[] };
  setFormData: React.Dispatch<React.SetStateAction<{ name: string; description: string; roomType: string; category: string; isActive: boolean; items: TemplateItem[] }>>;
  addItem: () => void;
  removeItem: (index: number) => void;
  updateItem: (index: number, field: keyof TemplateItem, value: string | boolean | number) => void;
  moveItemUp: (index: number) => void;
  moveItemDown: (index: number) => void;
  showPreview: boolean;
  setShowPreview: (v: boolean) => void;
  groupedPreview: Record<string, TemplateItem[]>;
  isEdit: boolean;
  isSaving: boolean;
  title: string;
  dbRoomTypes: { id: string; name: string }[];
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update template details and checklist items' : 'Define a new inspection checklist template'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto custom-scroll pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="tpl-name">Template Name *</Label>
              <Input
                id="tpl-name"
                placeholder="e.g., Standard Room Inspection"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea
                id="tpl-desc"
                placeholder="Brief description of this template..."
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Room Type</Label>
              <Select value={formData.roomType} onValueChange={(v) => setFormData((p) => ({ ...p, roomType: v === 'all' ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Room Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Room Types</SelectItem>
                  {dbRoomTypes.length > 0
                    ? dbRoomTypes.map((rt) => (
                        <SelectItem key={rt.id} value={rt.name}>{rt.name}</SelectItem>
                      ))
                    : ROOM_TYPES.filter((rt) => rt.value).map((rt) => (
                        <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c.value).map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Items Builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                Checklist Items ({formData.items.length})
              </Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  {showPreview ? 'Edit' : 'Preview'}
                </Button>
                <Button size="sm" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Item
                </Button>
              </div>
            </div>

            {showPreview ? (
              /* Preview Mode */
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                {Object.keys(groupedPreview).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No items to preview</p>
                ) : (
                  Object.entries(groupedPreview).map(([category, items]) => (
                    <div key={category}>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', CATEGORY_COLORS[category] || 'bg-gray-400')} />
                        {category}
                      </h4>
                      <div className="space-y-1.5">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <Checkbox checked disabled />
                            <span className="flex-1">{item.name || 'Unnamed item'}</span>
                            {item.required && <Badge variant="outline" className="text-xs text-red-500">Required</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Edit Mode */
              <ScrollArea className="max-h-96">
                <div className="space-y-2 pr-3">
                  {formData.items.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                      No items yet. Click &quot;Add Item&quot; to start building your checklist.
                    </p>
                  )}
                  {formData.items.map((item, index) => (
                    <div key={item.id} className="flex items-start gap-2 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col gap-0.5 mt-1">
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" disabled={index === 0} onClick={() => moveItemUp(index)}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" disabled={index === formData.items.length - 1} onClick={() => moveItemDown(index)}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-5">
                          <Input
                            placeholder="Item name..."
                            value={item.name}
                            onChange={(e) => updateItem(index, 'name', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <Input
                            placeholder="Category"
                            value={item.category}
                            onChange={(e) => updateItem(index, 'category', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2 flex items-center gap-2 pt-0.5">
                          <Switch
                            checked={item.required}
                            onCheckedChange={(v) => updateItem(index, 'required', v)}
                          />
                          <span className="text-xs text-muted-foreground">Req</span>
                        </div>
                        <div className="sm:col-span-2 flex justify-end">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => removeItem(index)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="tpl-active" className="cursor-pointer">Active Template</Label>
            <Switch id="tpl-active" checked={formData.isActive} onCheckedChange={(v) => setFormData((p) => ({ ...p, isActive: v }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Update Template' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── View Template Dialog ──

function ViewTemplateDialog({
  open,
  onClose,
  template,
}: {
  open: boolean;
  onClose: () => void;
  template: InspectionTemplate | null;
}) {
  const items = useMemo(() => parseJson<TemplateItem[]>(template?.items, []), [template?.items]);
  const grouped = useMemo(() => {
    const groups: Record<string, TemplateItem[]> = {};
    for (const item of items) {
      const cat = item.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-teal-600" />
            {template?.name}
          </DialogTitle>
          <DialogDescription>
            {template?.description || 'No description'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-96 overflow-y-auto custom-scroll">
          <div className="flex flex-wrap gap-2">
            {template?.roomType && (
              <Badge variant="outline" className="gap-1">
                <Home className="h-3 w-3" />
                {template.roomType.replace('_', ' ')}
              </Badge>
            )}
            <Badge variant="secondary" className={cn('text-white', CATEGORY_COLORS[template?.category || ''] || 'bg-gray-500')}>
              {template?.category?.replace('_', ' ')}
            </Badge>
            <Badge variant={template?.isActive ? 'default' : 'secondary'} className={template?.isActive ? 'bg-emerald-600' : ''}>
              {template?.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant="outline">{items.length} items</Badge>
          </div>

          {Object.entries(grouped).map(([category, catItems]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', CATEGORY_COLORS[category] || 'bg-gray-400')} />
                {category} ({catItems.length})
              </h4>
              <div className="space-y-1">
                {catItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50">
                    <span className="text-muted-foreground text-xs w-5">{idx + 1}.</span>
                    <span className="flex-1">{item.name}</span>
                    {item.required && <Badge variant="outline" className="text-xs text-red-500">Required</Badge>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 2: INSPECT ROOM
// ═══════════════════════════════════════════════════════════

function InspectTab() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [submittedResult, setSubmittedResult] = useState<{ score: number; passed: boolean; reAssigned: boolean } | null>(null);

  // Load properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch('/api/properties');
        const result = await res.json();
        if (result.success) setProperties(result.data);
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, []);

  // Load rooms when property changes
  useEffect(() => {
    const fetchRooms = async () => {
      if (!selectedPropertyId) { setRooms([]); return; }
      try {
        const res = await fetch(`/api/rooms?propertyId=${selectedPropertyId}`);
        const result = await res.json();
        if (result.success) {
          // Show rooms that need cleaning or are in various states
          const allRooms = result.data || [];
          setRooms(allRooms);
        }
      } catch (error) {
        console.error('Error fetching rooms:', error);
      }
    };
    fetchRooms();
  }, [selectedPropertyId]);

  // Load templates when property changes
  useEffect(() => {
    const fetchTemplates = async () => {
      if (!selectedPropertyId) { setTemplates([]); return; }
      try {
        const res = await fetch(`/api/inspection-templates?isActive=true&limit=50`);
        const result = await res.json();
        if (result.success) {
          setTemplates(result.data);
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
      }
    };
    fetchTemplates();
  }, [selectedPropertyId]);

  // Filter templates by room type using flexible matching
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const filteredTemplates = useMemo(() => {
    if (!selectedRoom?.roomType) return templates;
    const roomTypeName = selectedRoom.roomType.name;
    return templates.filter((t) => {
      return roomTypeMatches(t.roomType, roomTypeName);
    });
  }, [templates, selectedRoom]);

  // When template is selected, initialize inspection items
  useEffect(() => {
    if (!selectedTemplateId) { setInspectionItems([]); return; }
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    const tplItems = parseJson<TemplateItem[]>(tpl.items, []);
    setInspectionItems(
      tplItems.map((item) => ({
        templateItemId: item.id,
        name: item.name,
        passed: true,
        required: item.required,
        notes: '',
      }))
    );
    setInspectionNotes('');
    setSubmittedResult(null);
  }, [selectedTemplateId, templates]);

  const updateItemPassed = (index: number, passed: boolean) => {
    setInspectionItems((prev) => prev.map((item, i) => (i === index ? { ...item, passed } : item)));
  };

  const updateItemNotes = (index: number, notes: string) => {
    setInspectionItems((prev) => prev.map((item, i) => (i === index ? { ...item, notes } : item)));
  };

  // Calculate running score
  const runningScore = useMemo(() => {
    if (inspectionItems.length === 0) return 100;
    const requiredItems = inspectionItems.filter((item) => item.required);
    if (requiredItems.length === 0) return 100;
    const passedRequired = requiredItems.filter((item) => item.passed).length;
    return Math.round((passedRequired / requiredItems.length) * 100);
  }, [inspectionItems]);

  const failedCount = inspectionItems.filter((item) => !item.passed).length;
  const totalRequired = inspectionItems.filter((item) => item.required).length;
  const passedRequired = inspectionItems.filter((item) => item.required && item.passed).length;

  const handleSubmit = async () => {
    if (!selectedPropertyId || !selectedRoomId || !selectedTemplateId) {
      toast({ title: 'Error', description: 'Please select property, room, and template', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          roomId: selectedRoomId,
          templateId: selectedTemplateId,
          items: inspectionItems.map((item) => ({
            templateItemId: item.templateItemId,
            name: item.name,
            passed: item.passed,
            notes: item.notes || undefined,
          })),
          notes: inspectionNotes || undefined,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setSubmittedResult({
          score: result.data.score,
          passed: result.data.passed,
          reAssigned: result.data.reAssigned,
        });
        toast({
          title: result.data.passed ? 'Inspection Passed!' : 'Inspection Failed',
          description: `Score: ${result.data.score}%${result.data.reAssigned ? ' — Task has been reassigned for re-cleaning.' : ''}`,
          variant: result.data.passed ? 'default' : 'destructive',
        });
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to submit inspection', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error submitting inspection:', error);
      toast({ title: 'Error', description: 'Failed to submit inspection', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group items by category
  const groupedItems = useMemo(() => {
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    const tplItems = parseJson<TemplateItem[]>(tpl?.items, []);
    const tplItemMap = new Map(tplItems.map((ti) => [ti.id, ti.category || 'General']));

    const groups: Record<string, InspectionItem[]> = {};
    for (const item of inspectionItems) {
      const cat = tplItemMap.get(item.templateItemId) || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [inspectionItems, selectedTemplateId, templates]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Selection Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Room Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Property</Label>
              <Select value={selectedPropertyId} onValueChange={(v) => { setSelectedPropertyId(v); setSelectedRoomId(''); setSelectedTemplateId(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Room</Label>
              <Select value={selectedRoomId} onValueChange={(v) => { setSelectedRoomId(v); setSelectedTemplateId(''); }} disabled={!selectedPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.length === 0 ? (
                    <SelectItem value="_none" disabled>No rooms available</SelectItem>
                  ) : (
                    rooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        Room {r.number} — {r.roomType?.name || 'Unknown'} {r.housekeepingStatus === 'cleaning' ? '(Cleaning)' : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} disabled={!selectedRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTemplates.length === 0 ? (
                    <SelectItem value="_none" disabled>No templates available</SelectItem>
                  ) : (
                    filteredTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({parseJson<TemplateItem[]>(t.items, []).length} items)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submitted Result Banner */}
      {submittedResult && (
        <Card className={cn('p-4 border-2', submittedResult.passed ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50')}>
          <div className="flex items-center gap-4">
            {submittedResult.passed ? (
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
            <div>
              <h3 className="font-semibold">
                Inspection {submittedResult.passed ? 'Passed' : 'Failed'} — Score: {submittedResult.score}%
              </h3>
              <p className="text-sm text-muted-foreground">
                {submittedResult.reAssigned
                  ? 'The cleaning task has been reassigned for re-cleaning.'
                  : submittedResult.passed
                    ? 'The room has been marked as inspected and released.'
                    : 'Review the failed items and re-inspect after corrections.'}
              </p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setSubmittedResult(null)}>
              New Inspection
            </Button>
          </div>
        </Card>
      )}

      {/* Checklist Form */}
      {inspectionItems.length > 0 && !submittedResult && (
        <>
          {/* Running Score */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn('text-3xl font-bold', getScoreColor(runningScore))}>{runningScore}%</div>
                <div className="text-sm text-muted-foreground">
                  <div>{passedRequired} of {totalRequired} required items passed</div>
                  {failedCount > 0 && (
                    <div className="text-red-600 font-medium">{failedCount} item{failedCount !== 1 ? 's' : ''} failed</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn('w-16 h-2 rounded-full', getScoreBg(runningScore))} />
              </div>
            </div>
          </Card>

          {/* Grouped Checklist */}
          <div className="space-y-3">
            {Object.entries(groupedItems).map(([category, items]) => (
              <Card key={category}>
                <Collapsible open={!collapsedGroups.has(category)} onOpenChange={() => toggleGroup(category)}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-3 h-3 rounded-full', CATEGORY_COLORS[category] || 'bg-gray-400')} />
                        <h3 className="font-semibold text-sm">{category}</h3>
                        <Badge variant="outline" className="text-xs">{items.length}</Badge>
                        <Badge variant={items.every((i) => i.passed) ? 'default' : 'destructive'} className="text-xs">
                          {items.every((i) => i.passed) ? 'All Pass' : 'Has Failures'}
                        </Badge>
                      </div>
                      {collapsedGroups.has(category) ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-2">
                      {items.map((item, idx) => (
                        <div
                          key={item.templateItemId}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                            item.passed ? 'bg-card' : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                          )}
                        >
                          <div className="pt-0.5">
                            <Checkbox
                              checked={item.passed}
                              onCheckedChange={(v) => updateItemPassed(idx, v === true)}
                              className={cn(item.passed ? 'data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600' : 'data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600')}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{item.name}</span>
                              {item.required && <Badge variant="outline" className="text-xs text-red-500 shrink-0">Required</Badge>}
                            </div>
                            {!item.passed && (
                              <Input
                                placeholder="Notes for failed item..."
                                value={item.notes}
                                onChange={(e) => updateItemNotes(idx, e.target.value)}
                                className="mt-2 h-8 text-sm"
                              />
                            )}
                          </div>
                          <div className="shrink-0">
                            {item.passed ? (
                              <CheckCircle className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>

          {/* Notes + Submit */}
          <Card className="p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Inspection Notes</Label>
                <Textarea
                  placeholder="Additional notes about this inspection..."
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={isSubmitting || inspectionItems.length === 0}
                  className={cn(runningScore >= 90 ? 'bg-emerald-600 hover:bg-emerald-700' : runningScore >= 70 ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700')}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="h-4 w-4 mr-2" />
                      Submit Inspection
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Empty State */}
      {inspectionItems.length === 0 && !submittedResult && selectedPropertyId && (
        <Card className="p-8 text-center">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-1">Ready to Inspect</h3>
          <p className="text-sm text-muted-foreground">
            Select a property, room, and template above to begin the inspection
          </p>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 3: INSPECTION HISTORY
// ═══════════════════════════════════════════════════════════

function HistoryTab() {
  const { toast } = useToast();
  const [inspections, setInspections] = useState<InspectionResult[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [passedFilter, setPassedFilter] = useState('');
  const [stats, setStats] = useState({ total: 0, passed: 0, failed: 0, avgScore: 0 });

  // Detail dialog
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<InspectionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Load properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch('/api/properties');
        const result = await res.json();
        if (result.success) setProperties(result.data);
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, []);

  const fetchInspections = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyFilter) params.append('propertyId', propertyFilter);
      if (passedFilter) params.append('passed', passedFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', new Date(dateTo + 'T23:59:59').toISOString());

      const response = await fetch(`/api/inspections?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setInspections(result.data);
        setStats(result.stats || { total: 0, passed: 0, failed: 0, avgScore: 0 });
      }
    } catch (error) {
      console.error('Error fetching inspections:', error);
      toast({ title: 'Error', description: 'Failed to fetch inspections', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [propertyFilter, passedFilter, dateFrom, dateTo, toast]);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const viewDetail = async (id: string) => {
    setIsLoadingDetail(true);
    setIsDetailOpen(true);
    try {
      const res = await fetch(`/api/inspections/${id}`);
      const result = await res.json();
      if (result.success) {
        setSelectedInspection(result.data);
      } else {
        toast({ title: 'Error', description: 'Failed to load inspection details', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error fetching detail:', error);
      toast({ title: 'Error', description: 'Failed to load inspection details', variant: 'destructive' });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <ClipboardCheck className="h-4 w-4 text-teal-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.passed}</div>
              <div className="text-xs text-muted-foreground">Passed</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.failed}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Target className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.avgScore}%</div>
              <div className="text-xs text-muted-foreground">Avg Score</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="font-medium">Filters:</span>
            </div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-40"
              placeholder="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-40"
              placeholder="To date"
            />
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={passedFilter} onValueChange={setPassedFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Passed</SelectItem>
                <SelectItem value="false">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : inspections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mb-4" />
              <p>No inspections found</p>
              <p className="text-sm">Conduct an inspection to see results here</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Inspector</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspections.map((inspection) => (
                    <TableRow key={inspection.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {inspection.completedAt ? format(new Date(inspection.completedAt), 'MMM d, yyyy') : '-'}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {inspection.completedAt ? format(new Date(inspection.completedAt), 'h:mm a') : ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {inspection.room?.number || 'Unknown'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{inspection.template?.name || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {inspection.inspector
                            ? `${inspection.inspector.firstName} ${inspection.inspector.lastName}`
                            : 'Unknown'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn('text-sm font-bold', getScoreColor(inspection.score))}>
                          {inspection.score}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={inspection.passed ? 'default' : 'destructive'} className={cn('text-xs', inspection.passed ? 'bg-emerald-600' : '')}>
                          {inspection.passed ? 'Passed' : 'Failed'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground line-clamp-1 max-w-[150px]">
                          {inspection.notes || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => viewDetail(inspection.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          {isLoadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : selectedInspection ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Inspection Detail
                </DialogTitle>
                <DialogDescription>
                  Room {selectedInspection.room?.number || 'Unknown'} — {selectedInspection.template?.name || 'Unknown'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scroll">
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <div className={cn('text-2xl font-bold', getScoreColor(selectedInspection.score))}>
                      {selectedInspection.score}%
                    </div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <Badge variant={selectedInspection.passed ? 'default' : 'destructive'} className={cn('text-sm', selectedInspection.passed ? 'bg-emerald-600' : '')}>
                      {selectedInspection.passed ? 'Passed' : 'Failed'}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">Status</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-sm font-medium">
                      {selectedInspection.inspector
                        ? `${selectedInspection.inspector.firstName} ${selectedInspection.inspector.lastName}`
                        : 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-foreground">Inspector</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-sm font-medium">
                      {selectedInspection.completedAt ? format(new Date(selectedInspection.completedAt), 'MMM d, yyyy h:mm a') : '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">Date</div>
                  </div>
                </div>

                {selectedInspection.reAssigned && (
                  <div className="p-3 rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">Task Re-assigned for Re-cleaning</span>
                    </div>
                  </div>
                )}

                {/* Items */}
                {(() => {
                  const items = parseJson<InspectionItem[]>(selectedInspection.items, []);
                  const templateItems = parseJson<TemplateItem[]>(selectedInspection.template?.items, []);
                  const itemCatMap = new Map(templateItems.map((ti) => [ti.id, ti.category || 'General']));
                  const groups: Record<string, InspectionItem[]> = {};
                  for (const item of items) {
                    const cat = itemCatMap.get(item.templateItemId) || 'General';
                    if (!groups[cat]) groups[cat] = [];
                    groups[cat].push(item);
                  }
                  return Object.entries(groups).map(([category, catItems]) => (
                    <div key={category}>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', CATEGORY_COLORS[category] || 'bg-gray-400')} />
                        {category}
                      </h4>
                      <div className="space-y-1.5">
                        {catItems.map((item) => (
                          <div
                            key={item.templateItemId}
                            className={cn(
                              'flex items-center gap-3 p-2.5 rounded-lg border',
                              item.passed ? 'bg-card' : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                            )}
                          >
                            {item.passed ? (
                              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                            )}
                            <span className={cn('text-sm flex-1', item.passed ? '' : 'text-red-700 dark:text-red-400 font-medium')}>
                              {item.name}
                            </span>
                            {item.required && (
                              <Badge variant="outline" className="text-xs text-red-500 shrink-0">Required</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}

                {selectedInspection.notes && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <p className="text-sm mt-1">{selectedInspection.notes}</p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 4: QUALITY REPORTS
// ═══════════════════════════════════════════════════════════

function ReportsTab() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [propertyFilter, setPropertyFilter] = useState('');

  const [overviewStats, setOverviewStats] = useState({
    totalInspections: 0,
    passedCount: 0,
    failedCount: 0,
    passRate: 0,
    avgScore: 0,
  });
  const [inspectorBreakdown, setInspectorBreakdown] = useState<InspectorStat[]>([]);
  const [roomBreakdown, setRoomBreakdown] = useState<RoomStat[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch('/api/properties');
        const result = await res.json();
        if (result.success) setProperties(result.data);
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, []);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyFilter) params.append('propertyId', propertyFilter);

      const response = await fetch(`/api/inspections/stats?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        const data = result.data;
        setOverviewStats({
          totalInspections: data.totalInspections,
          passedCount: data.passedCount,
          failedCount: data.failedCount,
          passRate: data.passRate,
          avgScore: data.avgScore,
        });
        setInspectorBreakdown(data.inspectorBreakdown || []);
        setRoomBreakdown(data.roomBreakdown || []);
        setTrendData(data.trendData || []);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({ title: 'Error', description: 'Failed to fetch quality reports', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [propertyFilter, toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Today's count
  const inspectionsToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return trendData.find((d) => d.date === today)?.totalInspections || 0;
  }, [trendData]);

  // Max trend value for bar height calculation
  const maxTrendInspections = useMemo(() => {
    return Math.max(...trendData.map((d) => d.totalInspections), 1);
  }, [trendData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
          ))}
        </div>
        <Card className="p-4"><Skeleton className="h-64 w-full" /></Card>
        <Card className="p-4"><Skeleton className="h-48 w-full" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Property Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Label className="font-medium text-sm">Property:</Label>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Overview Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <ClipboardCheck className="h-4 w-4 text-teal-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{overviewStats.totalInspections}</div>
              <div className="text-xs text-muted-foreground">Total Inspections</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{overviewStats.passRate}%</div>
              <div className="text-xs text-muted-foreground">Pass Rate</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Target className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{overviewStats.avgScore}%</div>
              <div className="text-xs text-muted-foreground">Average Score</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <CalendarDays className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{inspectionsToday}</div>
              <div className="text-xs text-muted-foreground">Inspections Today</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Inspector Leaderboard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-600" />
            Inspector Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {inspectorBreakdown.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No inspection data available
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inspector</TableHead>
                    <TableHead className="text-center">Total Inspections</TableHead>
                    <TableHead className="text-center">Avg Score</TableHead>
                    <TableHead className="text-center">Pass Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspectorBreakdown.map((inspector, idx) => (
                    <TableRow key={inspector.inspectorId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium">{inspector.inspectorName}</span>
                          {idx === 0 && <Award className="h-4 w-4 text-amber-500" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{inspector.totalInspections}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn('text-sm font-bold', getScoreColor(inspector.avgScore))}>
                          {inspector.avgScore}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={inspector.passRate >= 90 ? 'default' : inspector.passRate >= 70 ? 'secondary' : 'destructive'}
                          className={cn('text-xs', inspector.passRate >= 90 ? 'bg-emerald-600' : '')}
                        >
                          {inspector.passRate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Score Trend (Last 30 Days) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-600" />
            Score Trend (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No trend data available
            </div>
          ) : (
            <div className="space-y-1">
              <ScrollArea className="max-h-96">
                <div className="flex items-end gap-1 pb-2">
                  {trendData.map((day) => {
                    const barHeight = Math.max((day.totalInspections / maxTrendInspections) * 100, 4);
                    return (
                      <div key={day.date} className="flex flex-col items-center flex-1 min-w-[20px]" title={`${day.date}: ${day.totalInspections} inspections, avg ${day.avgScore}%`}>
                        <span className="text-xs font-medium mb-1">{day.totalInspections > 0 ? day.avgScore : ''}</span>
                        <div
                          className={cn(
                            'w-full rounded-t transition-all hover:opacity-80',
                            day.avgScore >= 90 ? 'bg-emerald-500' : day.avgScore >= 70 ? 'bg-amber-500' : 'bg-red-500',
                            day.totalInspections === 0 && 'bg-muted'
                          )}
                          style={{ height: `${barHeight}px` }}
                        />
                        <span className="text-[9px] text-muted-foreground mt-1 truncate max-w-full">
                          {format(new Date(day.date), 'MMM d')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-500" />
                  <span>Score ≥ 90%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-amber-500" />
                  <span>Score 70-89%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span>Score &lt; 70%</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Room Quality Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="h-4 w-4 text-teal-600" />
            Room Quality Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {roomBreakdown.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No room inspection data available
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Last Inspection</TableHead>
                    <TableHead>Last Score</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomBreakdown.map((room) => (
                    <TableRow key={room.roomId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">Room {room.roomNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {room.lastInspectedAt
                          ? formatDistanceToNow(new Date(room.lastInspectedAt), { addSuffix: true })
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <span className={cn('text-sm font-bold', getScoreColor(room.lastScore))}>
                          {room.lastScore}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={room.lastScore >= 90 ? 'default' : room.lastScore >= 70 ? 'secondary' : 'destructive'}
                          className={cn('text-xs', room.lastScore >= 90 ? 'bg-emerald-600' : '')}
                        >
                          {room.lastScore >= 90 ? 'Excellent' : room.lastScore >= 70 ? 'Good' : 'Needs Attention'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
