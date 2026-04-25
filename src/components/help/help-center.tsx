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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
  HelpCircle, BookOpen, Search, Plus, Edit, Trash2, Eye, 
  ThumbsUp, ThumbsDown, Clock, FileText, Video, Image,
  ChevronRight, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

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

const categoryIcons: Record<string, typeof BookOpen> = {
  'getting-started': HelpCircle,
  'bookings': FileText,
  'guests': BookOpen,
  'reports': FileText,
  'settings': BookOpen,
  'integrations': BookOpen,
  'default': BookOpen,
};

const categoryColors: Record<string, string> = {
  'getting-started': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  'bookings': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  'guests': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  'reports': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'settings': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  'integrations': 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
};

interface HelpCenterProps {
  onSelectArticle?: (articleId: string) => void;
}

export function HelpCenter({ onSelectArticle }: HelpCenterProps) {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [stats, setStats] = useState<HelpStats>({
    total: 0,
    published: 0,
    draft: 0,
    totalViews: 0,
    totalHelpful: 0,
    categories: [],
  });
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<HelpArticle | null>(null);
  const [viewingArticle, setViewingArticle] = useState<HelpArticle | null>(null);
  const [deleteArticleId, setDeleteArticleId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    category: 'getting-started',
    tags: '',
    videoUrl: '',
    status: 'draft',
  });

  useEffect(() => {
    fetchArticles();
    fetchCategories();
  }, [search, selectedCategory]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('status', 'published');
      if (search) params.append('search', search);
      if (selectedCategory) params.append('category', selectedCategory);

      const response = await fetch(`/api/help/articles?${params}`);
      const data = await response.json();

      if (data.success) {
        setArticles(data.data.articles);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Error fetching help articles:', error);
      toast.error('Failed to fetch help articles');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/help/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

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
      setFormData({
        title: '',
        slug: '',
        content: '',
        excerpt: '',
        category: 'getting-started',
        tags: '[]',
        videoUrl: '',
        status: 'draft',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingArticle(null);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.slug || !formData.content) {
      toast.error('Title, slug, and content are required');
      return;
    }

    try {
      const url = '/api/help/articles';
      const method = editingArticle ? 'PUT' : 'POST';
      const body = editingArticle
        ? { id: editingArticle.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(editingArticle ? 'Article updated successfully' : 'Article created successfully');
        handleCloseDialog();
        fetchArticles();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      console.error('Error saving article:', error);
      toast.error('Failed to save article');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteArticleId(id);
  };

  const confirmDelete = async () => {
    if (!deleteArticleId) return;

    try {
      const response = await fetch(`/api/help/articles?id=${deleteArticleId}`, { method: 'DELETE' });
      const data = await response.json();

      if (data.success) {
        toast.success('Article deleted successfully');
        fetchArticles();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('Failed to delete article');
    } finally {
      setDeleteArticleId(null);
    }
  };

  const handleFeedback = async (id: string, helpful: boolean) => {
    try {
      const response = await fetch(`/api/help/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      });

      if (response.ok) {
        toast.success('Thank you for your feedback!');
        fetchArticles();
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not published';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Group articles by category
  const groupedArticles = articles.reduce((acc, article) => {
    if (!acc[article.category]) {
      acc[article.category] = [];
    }
    acc[article.category].push(article);
    return acc;
  }, {} as Record<string, HelpArticle[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Help Center</h1>
        <p className="text-muted-foreground">
          Find guides, tutorials, and documentation to help you use StaySuite
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Articles</p>
                <p className="text-xl font-bold">{stats.published}</p>
              </div>
              <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Categories</p>
                <p className="text-xl font-bold">{stats.categories.length}</p>
              </div>
              <HelpCircle className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Views</p>
                <p className="text-xl font-bold">{stats.totalViews.toLocaleString()}</p>
              </div>
              <Eye className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Helpful</p>
                <p className="text-xl font-bold">{stats.totalHelpful}</p>
              </div>
              <ThumbsUp className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />
          New Article
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Categories Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Categories</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="space-y-1 px-4 pb-4">
                <Button
                  variant={selectedCategory === null ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(null)}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  All Articles
                  <Badge variant="outline" className="ml-auto">
                    {stats.published}
                  </Badge>
                </Button>
                {categories.map((category) => {
                  const Icon = categoryIcons[category.slug] || categoryIcons.default;
                  return (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.slug ? 'secondary' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(category.slug)}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {category.name}
                      <Badge variant="outline" className="ml-auto">
                        {category.articleCount}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Articles List */}
        <div className="lg:col-span-3 space-y-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" />
            </div>
          ) : articles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No articles found</h3>
                <p className="text-muted-foreground mb-4">
                  {search || selectedCategory
                    ? 'Try adjusting your search or filter'
                    : 'Create your first help article to get started'}
                </p>
                {!search && !selectedCategory && (
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Article
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedArticles).map(([category, categoryArticles]) => (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold capitalize">{category.replace(/-/g, ' ')}</h2>
                  <Badge variant="outline">{categoryArticles.length}</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {categoryArticles.map((article) => (
                    <Card 
                      key={article.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onSelectArticle ? onSelectArticle(article.id) : setViewingArticle(article)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`rounded-lg p-2 ${
                            categoryColors[article.category] || categoryColors.default
                          }`}>
                            {article.videoUrl ? (
                              <Video className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{article.title}</h3>
                            {article.excerpt && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {article.excerpt}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {article.viewCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <ThumbsUp className="h-3 w-3" />
                                {article.helpfulCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(article.publishedAt)}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Article Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingArticle ? 'Edit Article' : 'Create Article'}</DialogTitle>
            <DialogDescription>
              Create a new help article or documentation
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      value={formData.title}
                      onChange={(e) => {
                        setFormData({ 
                          ...formData, 
                          title: e.target.value,
                          slug: editingArticle ? formData.slug : generateSlug(e.target.value)
                        });
                      }}
                      placeholder="Article title"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Slug</label>
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
                  <label className="text-sm font-medium">Content (Markdown)</label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="# Article content..."
                    rows={10}
                    className="font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Input
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g., getting-started"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Video URL (Optional)</label>
                    <Input
                      value={formData.videoUrl}
                      onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                      placeholder="https://youtube.com/..."
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
                      Draft
                    </Button>
                    <Button
                      type="button"
                      variant={formData.status === 'published' ? 'default' : 'outline'}
                      onClick={() => setFormData({ ...formData, status: 'published' })}
                    >
                      Published
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
              {editingArticle ? 'Save Changes' : 'Create Article'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Article Dialog */}
      <Dialog open={!!viewingArticle} onOpenChange={() => setViewingArticle(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewingArticle?.title}</DialogTitle>
            <DialogDescription>
              <Badge className={categoryColors[viewingArticle?.category || ''] || categoryColors.default}>
                {viewingArticle?.category.replace(/-/g, ' ')}
              </Badge>
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            {viewingArticle && (
              <div className="space-y-4 py-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap">{viewingArticle.content}</div>
                </div>

                <Separator />

                {/* Feedback Section */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {viewingArticle.viewCount} views
                    </span>
                    <span>Was this helpful?</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFeedback(viewingArticle.id, true)}
                    >
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      Yes ({viewingArticle.helpfulCount})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFeedback(viewingArticle.id, false)}
                    >
                      <ThumbsDown className="h-4 w-4 mr-1" />
                      No ({viewingArticle.notHelpfulCount})
                    </Button>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => {
                    setViewingArticle(null);
                    handleOpenDialog(viewingArticle);
                  }}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 dark:text-red-400" onClick={() => {
                    setViewingArticle(null);
                    handleDelete(viewingArticle.id);
                  }}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteArticleId} onOpenChange={(open) => !open && setDeleteArticleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this help article? This action cannot be undone.
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
