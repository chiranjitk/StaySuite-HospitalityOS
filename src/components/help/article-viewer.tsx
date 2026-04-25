'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, ThumbsUp, ThumbsDown, Eye, Clock, 
  Video, FileText, Share2, Bookmark, Printer, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useUIStore } from '@/store';

interface Article {
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
  createdAt: string;
  publishedAt: string | null;
}

interface ArticleViewerProps {
  articleId: string;
  onBack: () => void;
}

const categoryColors: Record<string, string> = {
  'getting-started': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  'bookings': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  'guests': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  'reports': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'settings': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  'integrations': 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
};

export function ArticleViewer({ articleId, onBack }: ArticleViewerProps) {
  const [article, setArticle] = useState<Article | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState<'helpful' | 'not-helpful' | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    fetchArticle();
  }, [articleId]);

  const fetchArticle = async () => {
    try {
      setLoading(true);
      // Check if article was already viewed this session to avoid double-counting
      const viewedKey = `help-article-viewed-${articleId}`;
      const alreadyViewed = typeof window !== 'undefined' && sessionStorage.getItem(viewedKey) === 'true';
      const url = `/api/help/articles/${articleId}${alreadyViewed ? '?skipViewCount=true' : ''}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setArticle(data.data);
        // Mark as viewed in this session
        if (typeof window !== 'undefined' && !alreadyViewed) {
          sessionStorage.setItem(viewedKey, 'true');
        }
        // Fetch related articles from same category
        fetchRelatedArticles(data.data.category, data.data.id);
      } else {
        toast.error('Article not found');
        onBack();
      }
    } catch (error) {
      console.error('Error fetching article:', error);
      toast.error('Failed to fetch article');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedArticles = async (category: string, currentId: string) => {
    try {
      const params = new URLSearchParams();
      params.append('category', category);
      params.append('status', 'published');
      params.append('limit', '5');

      const response = await fetch(`/api/help/articles?${params}`);
      const data = await response.json();

      if (data.success) {
        setRelatedArticles(
          data.data.articles
            .filter((a: Article) => a.id !== currentId)
            .slice(0, 4)
        );
      }
    } catch (error) {
      console.error('Error fetching related articles:', error);
    }
  };

  const handleFeedback = async (helpful: boolean) => {
    if (feedbackGiven) return;

    try {
      const response = await fetch(`/api/help/articles/${articleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      });

      if (response.ok) {
        setFeedbackGiven(helpful ? 'helpful' : 'not-helpful');
        toast.success('Thank you for your feedback!');
        if (article) {
          setArticle({
            ...article,
            helpfulCount: helpful ? article.helpfulCount + 1 : article.helpfulCount,
            notHelpfulCount: !helpful ? article.notHelpfulCount + 1 : article.notHelpfulCount,
          });
        }
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article?.title,
          url: window.location.href,
        });
      } catch (error) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not published';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Parse and render markdown-like content
  const renderContent = (content: string) => {
    // Simple markdown-like parsing
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-lg font-semibold mt-6 mb-2">{line.slice(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-semibold mt-8 mb-3">{line.slice(3)}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-2xl font-bold mt-8 mb-4">{line.slice(2)}</h1>;
      }
      
      // Lists
      if (line.startsWith('- ')) {
        return <li key={index} className="ml-4 list-disc">{line.slice(2)}</li>;
      }
      if (line.startsWith('* ')) {
        return <li key={index} className="ml-4 list-disc">{line.slice(2)}</li>;
      }
      if (/^\d+\. /.test(line)) {
        return <li key={index} className="ml-4 list-decimal">{line.replace(/^\d+\. /, '')}</li>;
      }
      
      // Bold
      if (line.includes('**')) {
        const parts = line.split(/\*\*(.*?)\*\*/);
        return (
          <p key={index} className="mb-2">
            {parts.map((part, i) => 
              i % 2 === 1 ? <strong key={i}>{part}</strong> : part
            )}
          </p>
        );
      }
      
      // Empty lines
      if (line.trim() === '') {
        return <br key={index} />;
      }
      
      // Regular paragraphs
      return <p key={index} className="mb-2">{line}</p>;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" />
      </div>
    );
  }

  if (!article) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Article not found</h3>
          <Button onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Help Center
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Help Center
      </Button>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Article Header */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <Badge className={categoryColors[article.category] || 'bg-gray-100 dark:bg-gray-800 dark:text-gray-300'}>
                      {article.category.replace(/-/g, ' ')}
                    </Badge>
                    <h1 className="text-2xl font-bold">{article.title}</h1>
                    {article.excerpt && (
                      <p className="text-muted-foreground">{article.excerpt}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={handleShare}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setBookmarked(!bookmarked)}
                    >
                      <Bookmark className={`h-4 w-4 ${bookmarked ? 'fill-current text-amber-500 dark:text-amber-400' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handlePrint}>
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {article.viewCount} views
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDate(article.publishedAt)}
                  </span>
                  {article.videoUrl && (
                    <span className="flex items-center gap-1">
                      <Video className="h-4 w-4" />
                      Video included
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Video Embed */}
          {article.videoUrl && (
            <Card>
              <CardContent className="p-4">
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <a 
                    href={article.videoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                  >
                    <Video className="h-8 w-8" />
                    <span className="font-medium">Watch Video</span>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Article Content */}
          <Card>
            <CardContent className="p-6">
              <div className="prose prose-neutral dark:prose-invert max-w-none">
                {renderContent(article.content)}
              </div>
            </CardContent>
          </Card>

          {/* Feedback Section */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-semibold">Was this article helpful?</h3>
                  <p className="text-sm text-muted-foreground">
                    Your feedback helps us improve our documentation
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={feedbackGiven === 'helpful' ? 'default' : 'outline'}
                    className={feedbackGiven === 'helpful' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    onClick={() => handleFeedback(true)}
                    disabled={!!feedbackGiven}
                  >
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    Yes ({article.helpfulCount + (feedbackGiven === 'helpful' ? 1 : 0)})
                  </Button>
                  <Button
                    variant={feedbackGiven === 'not-helpful' ? 'default' : 'outline'}
                    onClick={() => handleFeedback(false)}
                    disabled={!!feedbackGiven}
                  >
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    No ({article.notHelpfulCount + (feedbackGiven === 'not-helpful' ? 1 : 0)})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Table of Contents Placeholder */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">In this article</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[200px]">
                <div className="space-y-1 px-4 pb-4">
                  {article.content.split('\n')
                    .filter(line => line.startsWith('#'))
                    .slice(0, 10)
                    .map((line, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground"
                      >
                        {line.replace(/^#+ /, '').slice(0, 30)}
                      </Button>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Related Articles</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2 px-4 pb-4">
                  {relatedArticles.map((related) => (
                    <Button
                      key={related.id}
                      variant="ghost"
                      className="w-full justify-start h-auto py-2 text-left"
                      onClick={() => {
                        // Navigate to related article
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <div>
                        <p className="font-medium truncate">{related.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {related.category.replace(/-/g, ' ')}
                        </p>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Need Help */}
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">Need more help?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Can&apos;t find what you&apos;re looking for? Our support team is here to help.
              </p>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                useUIStore.getState().setActiveSection('experience-inbox');
              }}>
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
