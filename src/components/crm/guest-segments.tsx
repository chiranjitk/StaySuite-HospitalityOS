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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Users, Plus, Search, Edit, Trash2, Filter, X, 
  User, Mail, Star, DollarSign, Calendar, Building
} from 'lucide-react';
import { toast } from 'sonner';

interface Segment {
  id: string;
  name: string;
  description: string | null;
  rules: string;
  memberCount: number;
  createdAt: string;
  members: Array<{
    guest: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
      loyaltyTier: string;
      totalSpent: number;
    };
  }>;
}

interface SegmentStats {
  totalSegments: number;
  totalMembers: number;
  avgMembersPerSegment: number;
}

interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}

const ruleFields = [
  { value: 'loyaltyTier', label: 'Loyalty Tier', type: 'select' },
  { value: 'totalSpent', label: 'Total Spent', type: 'number' },
  { value: 'totalStays', label: 'Total Stays', type: 'number' },
  { value: 'loyaltyPoints', label: 'Loyalty Points', type: 'number' },
  { value: 'isVip', label: 'VIP Status', type: 'boolean' },
  { value: 'source', label: 'Booking Source', type: 'select' },
  { value: 'createdAt', label: 'Member Since', type: 'date' },
  { value: 'lastStayDate', label: 'Last Stay Date', type: 'date' },
];

const operators: Record<string, { value: string; label: string }[]> = {
  select: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'between', label: 'Between' },
  ],
  boolean: [
    { value: 'is_true', label: 'Is True' },
    { value: 'is_false', label: 'Is False' },
  ],
  date: [
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'in_last', label: 'In Last (Days)' },
    { value: 'in_next', label: 'In Next (Days)' },
  ],
};

const loyaltyTiers = ['bronze', 'silver', 'gold', 'platinum'];
const bookingSources = ['direct', 'booking_com', 'airbnb', 'expedia', 'walk_in', 'other'];

export default function GuestSegments() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [stats, setStats] = useState<SegmentStats>({ totalSegments: 0, totalMembers: 0, avgMembersPerSegment: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [viewingSegment, setViewingSegment] = useState<Segment | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [conditions, setConditions] = useState<RuleCondition[]>([]);

  useEffect(() => {
    fetchSegments();
  }, [search]);

  const fetchSegments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const response = await fetch(`/api/segments?${params}`);
      const data = await response.json();

      if (data.success) {
        setSegments(data.data.segments);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Error fetching segments:', error);
      toast.error('Failed to fetch segments');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (segment?: Segment) => {
    if (segment) {
      setEditingSegment(segment);
      setFormData({
        name: segment.name,
        description: segment.description || '',
      });
      try {
        const parsedRules = JSON.parse(segment.rules);
        setConditions(parsedRules.conditions || []);
      } catch {
        setConditions([]);
      }
    } else {
      setEditingSegment(null);
      setFormData({ name: '', description: '' });
      setConditions([]);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSegment(null);
    setFormData({ name: '', description: '' });
    setConditions([]);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Segment name is required');
      return;
    }

    try {
      const rules = JSON.stringify({
        conditions,
        logic: 'and',
      });

      const url = '/api/segments';
      const method = editingSegment ? 'PUT' : 'POST';
      const body = editingSegment
        ? { id: editingSegment.id, ...formData, rules }
        : { ...formData, rules };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(editingSegment ? 'Segment updated successfully' : 'Segment created successfully');
        handleCloseDialog();
        fetchSegments();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      console.error('Error saving segment:', error);
      toast.error('Failed to save segment');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteItemId(id);
  };

  const confirmDelete = async () => {
    if (!deleteItemId) return;

    try {
      const response = await fetch(`/api/segments?id=${deleteItemId}`, { method: 'DELETE' });
      const data = await response.json();

      if (data.success) {
        toast.success('Segment deleted successfully');
        fetchSegments();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      console.error('Error deleting segment:', error);
      toast.error('Failed to delete segment');
    } finally {
      setDeleteItemId(null);
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { field: 'loyaltyTier', operator: 'equals', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, key: keyof RuleCondition, value: string) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [key]: value };
    setConditions(updated);
  };

  const getFieldType = (fieldValue: string) => {
    return ruleFields.find(f => f.value === fieldValue)?.type || 'select';
  };

  const renderValueInput = (condition: RuleCondition, index: number) => {
    const fieldType = getFieldType(condition.field);

    if (fieldType === 'select') {
      const options = condition.field === 'loyaltyTier' ? loyaltyTiers : bookingSources;
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => updateCondition(index, 'value', v)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Value" />
          </SelectTrigger>
          <SelectContent>
            {options.map(opt => (
              <SelectItem key={opt} value={opt}>{opt.replace('_', ' ').toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (fieldType === 'boolean') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => updateCondition(index, 'value', v)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        type={fieldType}
        className="w-32"
        value={condition.value}
        onChange={(e) => updateCondition(index, 'value', e.target.value)}
        placeholder="Value"
      />
    );
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'bg-amber-100 text-amber-800',
      silver: 'bg-gray-100 text-gray-800',
      gold: 'bg-yellow-100 text-yellow-800',
      platinum: 'bg-purple-100 text-purple-800',
    };
    return colors[tier] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Guest Segments</h1>
        <p className="text-muted-foreground">
          Create and manage guest segments for targeted marketing campaigns
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Segments</p>
                <p className="text-2xl font-bold">{stats.totalSegments}</p>
              </div>
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                <Filter className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{stats.totalMembers.toLocaleString()}</p>
              </div>
              <div className="rounded-full bg-amber-100 dark:bg-amber-900 p-3">
                <Users className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Members/Segment</p>
                <p className="text-2xl font-bold">{stats.avgMembersPerSegment}</p>
              </div>
              <div className="rounded-full bg-cyan-100 dark:bg-cyan-900 p-3">
                <User className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search segments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />
          Create Segment
        </Button>
      </div>

      {/* Segments Grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : segments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No segments found</h3>
            <p className="text-muted-foreground mb-4">
              {search ? 'Try adjusting your search' : 'Create your first segment to get started'}
            </p>
            {!search && (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Segment
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {segments.map((segment) => (
            <Card key={segment.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{segment.name}</CardTitle>
                    {segment.description && (
                      <CardDescription className="mt-1">{segment.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                    {segment.memberCount} members
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Member Preview */}
                  {segment.members.length > 0 && (
                    <div className="flex -space-x-2">
                      {segment.members.slice(0, 4).map((m, i) => (
                        <div
                          key={i}
                          className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-gray-800"
                          title={`${m.guest.firstName} ${m.guest.lastName}`}
                        >
                          {m.guest.firstName[0]}{m.guest.lastName[0]}
                        </div>
                      ))}
                      {segment.memberCount > 4 && (
                        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium border-2 border-white dark:border-gray-800">
                          +{segment.memberCount - 4}
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Actions */}
                  <div className="flex justify-between items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewingSegment(segment)}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      View Members
                    </Button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(segment)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(segment.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingSegment ? 'Edit Segment' : 'Create Segment'}</DialogTitle>
            <DialogDescription>
              Define rules to automatically group guests based on their attributes and behavior
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Segment Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., VIP Guests, Frequent Travelers"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the purpose of this segment"
                    rows={2}
                  />
                </div>
              </div>

              <Separator />

              {/* Rules Builder */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">Segmentation Rules</h4>
                    <p className="text-sm text-muted-foreground">
                      Guests must match all conditions to be included
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addCondition}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Condition
                  </Button>
                </div>

                {conditions.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No conditions added. Add conditions to define your segment.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conditions.map((condition, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <Select
                          value={condition.field}
                          onValueChange={(v) => updateCondition(index, 'field', v)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {ruleFields.map(field => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={condition.operator}
                          onValueChange={(v) => updateCondition(index, 'operator', v)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Operator" />
                          </SelectTrigger>
                          <SelectContent>
                            {operators[getFieldType(condition.field)]?.map(op => (
                              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {renderValueInput(condition, index)}

                        <Button variant="ghost" size="icon" onClick={() => removeCondition(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
              {editingSegment ? 'Update Segment' : 'Create Segment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Members Dialog */}
      <Dialog open={!!viewingSegment} onOpenChange={() => setViewingSegment(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewingSegment?.name} - Members</DialogTitle>
            <DialogDescription>
              {viewingSegment?.memberCount} guests in this segment
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-2 py-4">
              {viewingSegment?.members.map((m, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-medium">
                      {m.guest.firstName[0]}{m.guest.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium">{m.guest.firstName} {m.guest.lastName}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {m.guest.email && (
                          <>
                            <Mail className="h-3 w-3" />
                            <span>{m.guest.email}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getTierColor(m.guest.loyaltyTier)}>
                      <Star className="h-3 w-3 mr-1" />
                      {m.guest.loyaltyTier}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      <DollarSign className="h-3 w-3 inline" />
                      {m.guest.totalSpent.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Segment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this segment? This action cannot be undone.
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
