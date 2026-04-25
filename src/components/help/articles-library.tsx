'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen, Search, Plus, Edit, Trash2, Eye, ThumbsUp, ThumbsDown,
  Clock, FileText, Video, CheckCircle, FileEdit, LayoutGrid, List,
  Filter, Loader2, ChevronDown, X,
} from 'lucide-react';
import { toast } from 'sonner';

// ──────────────── Interfaces ────────────────

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  category: string;
  tags: string;
  featuredImage: string | null;
  videoUrl: string | null;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  status: string;
  authorId: string | null;
  createdAt: string;
  publishedAt: string | null;
}

interface HelpStats {
  total: number;
  published: number;
  draft: number;
  totalViews: number;
  totalHelpful: number;
  categories: string[];
}

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  articleCount: number;
}

// ──────────────── Constants ────────────────

const categoryColors: Record<string, string> = {
  'getting-started': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  'bookings': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  'guests': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  'reports': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'settings': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  'integrations': 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
  'housekeeping': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
  'revenue': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'default': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

// ──────────────── Helpers ────────────────

function generateSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Draft';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ──────────────── Component ────────────────

export default function ArticlesLibrary() {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [stats, setStats] = useState<HelpStats>({
    total: 0, published: 0, draft: 0, totalViews: 0, totalHelpful: 0, categories: [],
  });
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<HelpArticle | null>(null);
  const [viewingArticle, setViewingArticle] = useState<HelpArticle | null>(null);
  const [deleteArticleId, setDeleteArticleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    category: 'getting-started',
    tags: '[]',
    videoUrl: '',
    status: 'draft',
  });

  // ── Data fetching ──

  useEffect(() => {
    fetchArticles();
    fetchCategories();
  }, [search, categoryFilter, statusFilter, sortBy]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('limit', '100');

      const response = await fetch(`/api/help/articles?${params}`);
      const data = await response.json();
      if (data.success) {
        setArticles(data.data.articles);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast.error('Failed to fetch articles');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/help/categories');
      const data = await response.json();
      if (data.success) setCategories(data.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // ── Sorting ──

  const sortedArticles = useMemo(() => {
    const sorted = [...articles];
    switch (sortBy) {
      case 'newest': return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'oldest': return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'views': return sorted.sort((a, b) => b.viewCount - a.viewCount);
      case 'helpful': return sorted.sort((a, b) => b.helpfulCount - a.helpfulCount);
      default: return sorted;
    }
  }, [articles, sortBy]);

  // ── CRUD Handlers ──

  const handleOpenDialog = (article?: HelpArticle) => {
    if (article) {
      setEditingArticle(article);
      setFormData({
        title: article.title,
        slug: article.slug,
        content: article.content,
        excerpt: article.excerpt || '',
        category: article.category,
        tags: article.tags,
        videoUrl: article.videoUrl || '',
        status: article.status,
      });
    } else {
      setEditingArticle(null);
      setFormData({ title: '', slug: '', content: '', excerpt: '', category: 'getting-started', tags: '[]', videoUrl: '', status: 'draft' });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.slug || !formData.content) {
      toast.error('Title, slug, and content are required');
      return;
    }
    setIsSaving(true);
    try {
      const url = '/api/help/articles';
      const method = editingArticle ? 'PUT' : 'POST';
      const body = editingArticle ? { id: editingArticle.id, ...formData } : formData;

      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();

      if (data.success) {
        toast.success(editingArticle ? 'Article updated' : 'Article created');
        setDialogOpen(false);
        setEditingArticle(null);
        fetchArticles();
      } else {
        toast.error(data.error?.message || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save article');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteArticleId) return;
    try {
      const response = await fetch(`/api/help/articles?id=${deleteArticleId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        toast.success('Article deleted');
        fetchArticles();
      } else {
        toast.error(data.error?.message || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete article');
    } finally {
      setDeleteArticleId(null);
    }
  };

  const handleFeedback = async (id: string, helpful: boolean) => {
    try {
      await fetch(`/api/help/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      });
      toast.success('Thanks for your feedback!');
      fetchArticles();
    } catch {
      toast.error('Failed to submit feedback');
    }
  };

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">Browse, create, and manage help articles and documentation</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-emerald-600 hover:bg-emerald-700 w-fit">
          <Plus className="h-4 w-4 mr-2" />
          New Article
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10"><BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Articles</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10"><CheckCircle className="h-5 w-5 text-cyan-600 dark:text-cyan-400" /></div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Published</p>
              <p className="text-xl font-bold">{stats.published}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10"><FileEdit className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Drafts</p>
              <p className="text-xl font-bold">{stats.draft}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10"><Eye className="h-5 w-5 text-rose-600 dark:text-rose-400" /></div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Views</p>
              <p className="text-xl font-bold">{stats.totalViews.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles by title, content..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="views">Most Viewed</SelectItem>
                  <SelectItem value="helpful">Most Helpful</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-9 w-9 rounded-r-none"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-9 w-9 rounded-l-none"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Filters */}
      {(search || categoryFilter !== 'all' || statusFilter !== 'all') && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {search && (
            <Badge variant="secondary" className="gap-1">
              &quot;{search}&quot;
              <button onClick={() => setSearch('')}><X className="h-3 w-3 ml-1" /></button>
            </Badge>
          )}
          {categoryFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {categories.find(c => c.slug === categoryFilter)?.name || categoryFilter}
              <button onClick={() => setCategoryFilter('all')}><X className="h-3 w-3 ml-1" /></button>
            </Badge>
          )}
          {statusFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {statusFilter}
              <button onClick={() => setStatusFilter('all')}><X className="h-3 w-3 ml-1" /></button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setSearch(''); setCategoryFilter('all'); setStatusFilter('all'); }}>
            Clear all
          </Button>
        </div>
      )}

      {/* Articles Grid / List */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : sortedArticles.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No articles found</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {search || categoryFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search or filters to find what you\'re looking for.'
                : 'Get started by creating your first help article.'}
            </p>
            <div className="flex gap-2 justify-center">
              {(search || categoryFilter !== 'all' || statusFilter !== 'all') && (
                <Button variant="outline" onClick={() => { setSearch(''); setCategoryFilter('all'); setStatusFilter('all'); }}>
                  <Filter className="h-4 w-4 mr-2" />Clear Filters
                </Button>
              )}
              <Button onClick={() => handleOpenDialog()} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />Create Article
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedArticles.map((article) => (
            <Card key={article.id} className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={categoryColors[article.category] || categoryColors.default}>
                    {article.category.replace(/-/g, ' ')}
                  </Badge>
                  <Badge variant={article.status === 'published' ? 'default' : 'secondary'} className={article.status === 'published' ? 'bg-emerald-600 hover:bg-emerald-700 text-xs' : 'bg-amber-500 hover:bg-amber-600 text-white text-xs'}>
                    {article.status === 'published' ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                <h3 className="font-semibold leading-tight line-clamp-2">{article.title}</h3>
                {article.excerpt && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {article.videoUrl && <Video className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />}
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.viewCount}</span>
                  <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{article.helpfulCount}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(article.publishedAt)}</span>
                </div>
                <Separator />
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="flex-1 h-8" onClick={() => setViewingArticle(article)}>
                    <Eye className="h-3.5 w-3.5 mr-1" />View
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 h-8" onClick={() => handleOpenDialog(article)}>
                    <Edit className="h-3.5 w-3.5 mr-1" />Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-red-500 dark:text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteArticleId(article.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedArticles.map((article) => (
            <Card key={article.id} className="group hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={categoryColors[article.category] || categoryColors.default}>
                        {article.category.replace(/-/g, ' ')}
                      </Badge>
                      <Badge variant={article.status === 'published' ? 'default' : 'secondary'} className={article.status === 'published' ? 'bg-emerald-600 hover:bg-emerald-700 text-xs' : 'bg-amber-500 hover:bg-amber-600 text-white text-xs'}>
                        {article.status === 'published' ? 'Published' : 'Draft'}
                      </Badge>
                      {article.videoUrl && <Video className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />}
                    </div>
                    <h3 className="font-semibold truncate">{article.title}</h3>
                    {article.excerpt && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">{article.excerpt}</p>
                    )}
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.viewCount}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{article.helpfulCount}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(article.publishedAt)}</span>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => setViewingArticle(article)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => handleOpenDialog(article)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-red-500 dark:text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteArticleId(article.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results count */}
      {!loading && sortedArticles.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {sortedArticles.length} of {stats.total} articles
        </p>
      )}

      {/* ── Create/Edit Article Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); setEditingArticle(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingArticle ? 'Edit Article' : 'Create Article'}</DialogTitle>
            <DialogDescription>
              {editingArticle ? 'Update article details and content' : 'Write a new help article or documentation'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value, slug: editingArticle ? formData.slug : generateSlug(e.target.value) })}
                    placeholder="Article title"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Slug *</label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="article-url-slug"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Excerpt</label>
                <Input
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  placeholder="Brief description for article preview"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Content (Markdown) *</label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="# Article content...&#10;&#10;Write your article content here using Markdown formatting."
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.length > 0 ? categories.map((c) => (
                        <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                      )) : (
                        <>
                          <SelectItem value="getting-started">Getting Started</SelectItem>
                          <SelectItem value="bookings">Bookings</SelectItem>
                          <SelectItem value="guests">Guests</SelectItem>
                          <SelectItem value="housekeeping">Housekeeping</SelectItem>
                          <SelectItem value="revenue">Revenue</SelectItem>
                          <SelectItem value="reports">Reports</SelectItem>
                          <SelectItem value="settings">Settings</SelectItem>
                          <SelectItem value="integrations">Integrations</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Video URL (Optional)</label>
                  <Input
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    placeholder="https://example.com/video"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={formData.status === 'draft' ? 'default' : 'outline'}
                    onClick={() => setFormData({ ...formData, status: 'draft' })}
                  >
                    <FileEdit className="h-4 w-4 mr-2" />Draft
                  </Button>
                  <Button
                    type="button"
                    variant={formData.status === 'published' ? 'default' : 'outline'}
                    className={formData.status === 'published' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    onClick={() => setFormData({ ...formData, status: 'published' })}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />Published
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingArticle(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingArticle ? 'Save Changes' : 'Create Article'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Article Dialog ── */}
      <Dialog open={!!viewingArticle} onOpenChange={() => setViewingArticle(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={categoryColors[viewingArticle?.category || ''] || categoryColors.default}>
                {viewingArticle?.category.replace(/-/g, ' ')}
              </Badge>
              <Badge variant={viewingArticle?.status === 'published' ? 'default' : 'secondary'} className={viewingArticle?.status === 'published' ? 'bg-emerald-600 text-xs' : 'bg-amber-500 text-white text-xs'}>
                {viewingArticle?.status === 'published' ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <DialogTitle className="text-xl">{viewingArticle?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{viewingArticle?.viewCount} views</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{viewingArticle && formatDate(viewingArticle.publishedAt)}</span>
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            {viewingArticle && (
              <div className="space-y-6 py-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap leading-relaxed">{viewingArticle.content}</div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Was this article helpful?</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleFeedback(viewingArticle.id, true)}>
                      <ThumbsUp className="h-4 w-4 mr-1" />Yes ({viewingArticle.helpfulCount})
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleFeedback(viewingArticle.id, false)}>
                      <ThumbsDown className="h-4 w-4 mr-1" />No ({viewingArticle.notHelpfulCount})
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { const a = viewingArticle; setViewingArticle(null); handleOpenDialog(a); }}>
                    <Edit className="h-4 w-4 mr-1" />Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-500 dark:text-red-400 hover:text-red-600" onClick={() => { setDeleteArticleId(viewingArticle.id); setViewingArticle(null); }}>
                    <Trash2 className="h-4 w-4 mr-1" />Delete
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteArticleId} onOpenChange={(open) => !open && setDeleteArticleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this article? This action cannot be undone.
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
