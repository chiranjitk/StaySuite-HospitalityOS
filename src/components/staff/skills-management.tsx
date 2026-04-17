'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  GraduationCap,
  Plus,
  Trash2,
  Users,
  Award,
  Loader2,
  Filter,
  ShieldCheck,
  Calendar,
  Star,
  TrendingUp,
  Brain,
  Globe,
  HeartHandshake,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  jobTitle: string;
  avatar: string | null;
}

interface StaffSkill {
  id: string;
  tenantId: string;
  userId: string;
  skillName: string;
  skillLevel: number;
  category: string;
  certified: boolean;
  certifiedAt: string | null;
  certifiedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  user?: StaffMember;
}

interface SkillsSummary {
  byCategory: Record<string, number>;
  certified: number;
}

const CATEGORIES = [
  { value: 'technical', label: 'Technical', icon: Brain },
  { value: 'language', label: 'Language', icon: Globe },
  { value: 'certification', label: 'Certification', icon: Award },
  { value: 'soft_skill', label: 'Soft Skill', icon: MessageSquare },
  { value: 'hospitality', label: 'Hospitality', icon: HeartHandshake },
];

const CATEGORY_COLORS: Record<string, string> = {
  technical: 'bg-blue-100 text-blue-700',
  language: 'bg-purple-100 text-purple-700',
  certification: 'bg-amber-100 text-amber-700',
  soft_skill: 'bg-green-100 text-green-700',
  hospitality: 'bg-pink-100 text-pink-700',
};

const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Elementary',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};

export default function SkillsManagement() {
  const [skills, setSkills] = useState<StaffSkill[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [summary, setSummary] = useState<SkillsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [filterCertified, setFilterCertified] = useState<string>('all');

  // Dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deleteSkillName, setDeleteSkillName] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    skillName: '',
    category: 'technical',
    skillLevel: '3',
    certified: false,
    certifiedAt: '',
    notes: '',
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);

      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.append('category', filterCategory);
      if (filterStaff !== 'all') params.append('userId', filterStaff);
      if (filterCertified === 'true') params.append('certified', 'true');

      const [skillsRes, staffRes] = await Promise.all([
        fetch(`/api/staff/skills?${params}`),
        fetch('/api/users'),
      ]);

      if (skillsRes.ok) {
        const skillsData = await skillsRes.json();
        setSkills(skillsData.data || []);
        setSummary(skillsData.summary || null);
      }

      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaff(staffData.users || []);
      }
    } catch (error) {
      console.error('Error fetching skills data:', error);
      toast.error('Failed to load skills');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterCategory, filterStaff, filterCertified]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        userId: formData.userId,
        skillName: formData.skillName,
        category: formData.category,
        skillLevel: parseInt(formData.skillLevel, 10),
        certified: formData.certified,
        certifiedAt: formData.certified ? formData.certifiedAt || new Date().toISOString() : null,
        notes: formData.notes || null,
      };

      const response = await fetch('/api/staff/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Failed to add skill');
      }

      toast.success('Skill added successfully');
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add skill');
    }
  };

  const handleDelete = (skillId: string, skillName: string) => {
    setDeleteItemId(skillId);
    setDeleteSkillName(skillName);
  };

  const confirmDelete = async () => {
    if (!deleteItemId) return;

    try {
      const response = await fetch(`/api/staff/skills?id=${deleteItemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete skill');

      toast.success('Skill deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete skill');
    } finally {
      setDeleteItemId(null);
      setDeleteSkillName('');
    }
  };

  const resetForm = () => {
    setFormData({
      userId: '',
      skillName: '',
      category: 'technical',
      skillLevel: '3',
      certified: false,
      certifiedAt: '',
      notes: '',
    });
  };

  const getProficiencyColor = (level: number) => {
    if (level <= 2) return 'text-orange-600';
    if (level <= 3) return 'text-blue-600';
    return 'text-green-600';
  };

  const getProficiencyProgress = (level: number) => {
    return (level / 5) * 100;
  };

  const getCategoryLabel = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat ? cat.label : category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat ? cat.icon : Star;
  };

  const formatCertificationDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString();
  };

  const isCertificationExpiring = (certifiedAt: string | null) => {
    if (!certifiedAt) return false;
    const certDate = new Date(certifiedAt);
    const expiryDate = new Date(certDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1-year validity
    const now = new Date();
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    return expiryDate <= threeMonthsFromNow && expiryDate >= now;
  };

  const isCertificationExpired = (certifiedAt: string | null) => {
    if (!certifiedAt) return false;
    const certDate = new Date(certifiedAt);
    const expiryDate = new Date(certDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    return expiryDate < new Date();
  };

  const getCertificationExpiryDate = (certifiedAt: string | null) => {
    if (!certifiedAt) return null;
    const certDate = new Date(certifiedAt);
    const expiryDate = new Date(certDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    return expiryDate;
  };

  const groupedSkills = useMemo(() => {
    const groups: Record<string, StaffSkill[]> = {};
    skills.forEach((skill) => {
      const cat = skill.category || 'general';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(skill);
    });
    return groups;
  }, [skills]);

  const totalSkills = skills.length;
  const certifiedSkills = skills.filter((s) => s.certified).length;
  const uniqueStaff = new Set(skills.map((s) => s.userId)).size;
  const avgProficiency = totalSkills > 0
    ? (skills.reduce((sum, s) => sum + s.skillLevel, 0) / totalSkills).toFixed(1)
    : '0';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Staff Skills</h2>
          <p className="text-muted-foreground">Manage staff competencies, certifications, and proficiency levels</p>
        </div>
        <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Skill
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Skills</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSkills}</div>
            <p className="text-xs text-muted-foreground">Across all categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certified</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{certifiedSkills}</div>
            <p className="text-xs text-muted-foreground">
              {totalSkills > 0 ? `${Math.round((certifiedSkills / totalSkills) * 100)}% of total` : 'No skills'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Members</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{uniqueStaff}</div>
            <p className="text-xs text-muted-foreground">With recorded skills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Proficiency</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{avgProficiency}</div>
            <p className="text-xs text-muted-foreground">Out of 5.0</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Staff Member</Label>
              <Select value={filterStaff} onValueChange={setFilterStaff}>
                <SelectTrigger>
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}{s.jobTitle ? ` - ${s.jobTitle}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Certification</Label>
              <Select value={filterCertified} onValueChange={setFilterCertified}>
                <SelectTrigger>
                  <SelectValue placeholder="All skills" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Skills</SelectItem>
                  <SelectItem value="true">Certified Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skills by Category */}
      {Object.keys(groupedSkills).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No skills found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filterCategory !== 'all' || filterStaff !== 'all' || filterCertified !== 'all'
                ? 'Try adjusting your filters or add a new skill.'
                : 'Add a skill to get started.'}
            </p>
            <Button className="mt-4" onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Skill
            </Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedSkills).map(([category, categorySkills]) => {
          const CategoryIcon = getCategoryIcon(category);
          const categoryLabel = getCategoryLabel(category);
          const categoryCount = summary?.byCategory[category] || categorySkills.length;

          return (
            <Card key={category}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{categoryLabel}</CardTitle>
                      <CardDescription>{categoryCount} skill{categoryCount !== 1 ? 's' : ''}</CardDescription>
                    </div>
                  </div>
                  <Badge className={CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-700'}>
                    {categoryLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Skill</TableHead>
                        <TableHead>Proficiency</TableHead>
                        <TableHead>Certification</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categorySkills.map((skill) => {
                        const expired = skill.certified && isCertificationExpired(skill.certifiedAt);
                        const expiring = skill.certified && !expired && isCertificationExpiring(skill.certifiedAt);
                        const expiryDate = getCertificationExpiryDate(skill.certifiedAt);

                        return (
                          <TableRow key={skill.id} className={expired ? 'bg-red-50' : ''}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {skill.user?.firstName} {skill.user?.lastName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {skill.user?.jobTitle || skill.user?.department}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{skill.skillName}</p>
                                {skill.notes && (
                                  <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                    {skill.notes}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3 min-w-[160px]">
                                <Progress
                                  value={getProficiencyProgress(skill.skillLevel)}
                                  className="h-2 flex-1"
                                />
                                <span className={`text-sm font-medium whitespace-nowrap ${getProficiencyColor(skill.skillLevel)}`}>
                                  {skill.skillLevel}/5
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {PROFICIENCY_LABELS[skill.skillLevel] || 'Unknown'}
                              </p>
                            </TableCell>
                            <TableCell>
                              {skill.certified ? (
                                <div className="flex flex-col gap-1">
                                  <Badge
                                    variant={(expired ? 'destructive' : expiring ? 'warning' : 'success') as 'default' | 'secondary' | 'destructive' | 'outline'}
                                    className="w-fit gap-1"
                                  >
                                    <ShieldCheck className="h-3 w-3" />
                                    {expired ? 'Expired' : expiring ? 'Expiring Soon' : 'Certified'}
                                  </Badge>
                                  {expiryDate && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      Expires: {formatCertificationDate(expiryDate.toISOString())}
                                    </div>
                                  )}
                                  {skill.certifiedAt && (
                                    <p className="text-xs text-muted-foreground">
                                      Issued: {formatCertificationDate(skill.certifiedAt)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">Not certified</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(skill.id, skill.skillName)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Category Summary Card */}
      {summary && Object.keys(summary.byCategory).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skills Overview by Category</CardTitle>
            <CardDescription>Distribution of skills across categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-5">
              {CATEGORIES.map((cat) => {
                const count = summary.byCategory[cat.value] || 0;
                const percentage = totalSkills > 0 ? Math.round((count / totalSkills) * 100) : 0;
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.value}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                  >
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cat.label}</p>
                      <p className="text-xs text-muted-foreground">{count} skills ({percentage}%)</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Skill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteSkillName}</strong>? This action cannot be undone.
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

      {/* Add Skill Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Skill</DialogTitle>
            <DialogDescription>
              Add a skill to a staff member&apos;s profile with proficiency level and optional certification
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">Staff Member *</Label>
              <Select
                value={formData.userId}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, userId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}{s.jobTitle ? ` - ${s.jobTitle}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="skillName">Skill Name *</Label>
              <Input
                id="skillName"
                value={formData.skillName}
                onChange={(e) => setFormData((prev) => ({ ...prev, skillName: e.target.value }))}
                placeholder="e.g., CPR, Spanish, Excel, Customer Service"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Proficiency Level</Label>
                <Select
                  value={formData.skillLevel}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, skillLevel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROFICIENCY_LABELS).map(([level, label]) => (
                      <SelectItem key={level} value={level}>
                        {level} - {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="certified"
                  checked={formData.certified}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, certified: checked === true }))
                  }
                />
                <Label htmlFor="certified" className="flex items-center gap-2 cursor-pointer">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  Staff member is certified in this skill
                </Label>
              </div>
              {formData.certified && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="certifiedAt">Certification Date</Label>
                  <Input
                    id="certifiedAt"
                    type="date"
                    value={formData.certifiedAt}
                    onChange={(e) => setFormData((prev) => ({ ...prev, certifiedAt: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use today&apos;s date. Certification validity is 1 year from this date.
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes about this skill"
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Add Skill</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
