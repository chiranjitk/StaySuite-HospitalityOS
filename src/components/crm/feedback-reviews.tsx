'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
  Star, MessageSquare, AlertCircle, ThumbsUp, Search, 
  Eye, CheckCircle, Clock, X, TrendingUp, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Review {
  id: string;
  guestId: string;
  propertyId: string;
  overallRating: number;
  cleanlinessRating: number | null;
  serviceRating: number | null;
  locationRating: number | null;
  valueRating: number | null;
  title: string | null;
  comment: string | null;
  source: string;
  responseText: string | null;
  respondedAt: string | null;
  sentimentScore: number | null;
  sentimentLabel: string | null;
  createdAt: string;
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
}

interface Feedback {
  id: string;
  type: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  guest: {
    firstName: string;
    lastName: string;
    email: string | null;
  };
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  responseRate: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  bySource: { internal: number; google: number; booking_com: number; tripadvisor: number };
}

interface FeedbackStats {
  total: number;
  open: number;
  resolved: number;
  byType: { complaint: number; compliment: number; suggestion: number };
  byStatus: { open: number; in_progress: number; resolved: number; closed: number };
  byPriority: { low: number; medium: number; high: number; critical: number };
}

export default function FeedbackReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({
    totalReviews: 0,
    averageRating: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    responseRate: 0,
    sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
    bySource: { internal: 0, google: 0, booking_com: 0, tripadvisor: 0 },
  });
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats>({
    total: 0,
    open: 0,
    resolved: 0,
    byType: { complaint: 0, compliment: 0, suggestion: 0 },
    byStatus: { open: 0, in_progress: 0, resolved: 0, closed: 0 },
    byPriority: { low: 0, medium: 0, high: 0, critical: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewingReview, setViewingReview] = useState<Review | null>(null);
  const [viewingFeedback, setViewingFeedback] = useState<Feedback | null>(null);
  const [responseText, setResponseText] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [ratingFilter, typeFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch reviews
      const reviewsParams = new URLSearchParams();
      if (ratingFilter !== 'all') {
        reviewsParams.append('minRating', ratingFilter);
        reviewsParams.append('maxRating', ratingFilter);
      }
      
      const reviewsResponse = await fetch(`/api/crm/reviews?${reviewsParams}`);
      const reviewsData = await reviewsResponse.json();

      if (reviewsData.success) {
        setReviews(reviewsData.data.reviews);
        setReviewStats(reviewsData.data.stats);
      }

      // Fetch feedback
      const feedbackParams = new URLSearchParams();
      if (typeFilter !== 'all') {
        feedbackParams.append('type', typeFilter);
      }
      
      const feedbackResponse = await fetch(`/api/crm/feedback?${feedbackParams}`);
      const feedbackData = await feedbackResponse.json();

      if (feedbackData.success) {
        setFeedbacks(feedbackData.data.feedbacks);
        setFeedbackStats(feedbackData.data.stats);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleRespondToReview = async () => {
    if (!viewingReview || !responseText.trim()) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/crm/reviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: viewingReview.id,
          responseText,
          respondedBy: 'Property Manager',
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Response submitted successfully');
        setReviews(prev => prev.map(r => 
          r.id === viewingReview.id 
            ? { ...r, responseText, respondedAt: new Date().toISOString() }
            : r
        ));
        setViewingReview(null);
        setResponseText('');
      } else {
        toast.error(data.error?.message || 'Failed to submit response');
      }
    } catch (error) {
      toast.error('Failed to submit response');
    } finally {
      setSaving(false);
    }
  };

  const handleResolveFeedback = async () => {
    if (!viewingFeedback || !resolutionText.trim()) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/crm/feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: viewingFeedback.id,
          status: 'resolved',
          resolution: resolutionText,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Feedback resolved successfully');
        setFeedbacks(prev => prev.map(f => 
          f.id === viewingFeedback.id 
            ? { ...f, status: 'resolved', resolvedAt: new Date().toISOString(), resolution: resolutionText }
            : f
        ));
        setViewingFeedback(null);
        setResolutionText('');
      } else {
        toast.error(data.error?.message || 'Failed to resolve feedback');
      }
    } catch (error) {
      toast.error('Failed to resolve feedback');
    } finally {
      setSaving(false);
    }
  };

  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    const starSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starSize} transition-transform duration-150 ${
              star <= rating
                ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  };

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      internal: 'bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 dark:from-emerald-900 dark:to-emerald-800 dark:text-emerald-300 border-0',
      google: 'bg-gradient-to-r from-rose-100 to-rose-200 text-rose-800 dark:from-rose-900 dark:to-rose-800 dark:text-rose-300 border-0',
      booking_com: 'bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 dark:from-amber-900 dark:to-amber-800 dark:text-amber-300 border-0',
      tripadvisor: 'bg-gradient-to-r from-cyan-100 to-cyan-200 text-cyan-800 dark:from-cyan-900 dark:to-cyan-800 dark:text-cyan-300 border-0',
    };
    return colors[source] || 'bg-gray-100 text-gray-800';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'complaint': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'compliment': return <ThumbsUp className="h-4 w-4 text-emerald-500" />;
      case 'suggestion': return <MessageSquare className="h-4 w-4 text-cyan-500" />;
      default: return <MessageSquare className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-amber-100 text-amber-800',
      high: 'bg-red-100 text-red-800',
      critical: 'bg-red-500 text-white',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-amber-100 text-amber-800',
      in_progress: 'bg-cyan-100 text-cyan-800',
      resolved: 'bg-emerald-100 text-emerald-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredReviews = search 
    ? reviews.filter(r => 
        r.title?.toLowerCase().includes(search.toLowerCase()) ||
        r.comment?.toLowerCase().includes(search.toLowerCase()) ||
        `${r.guest.firstName} ${r.guest.lastName}`.toLowerCase().includes(search.toLowerCase())
      )
    : reviews;

  const filteredFeedbacks = typeFilter === 'all' 
    ? feedbacks 
    : feedbacks.filter(f => f.type === typeFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Feedback & Reviews</h1>
        <p className="text-muted-foreground">
          Monitor guest reviews and manage feedback across all channels
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Avg Rating</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{reviewStats.averageRating}</p>
                  <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Reviews</p>
                <p className="text-2xl font-bold">{reviewStats.totalReviews}</p>
              </div>
              <MessageSquare className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Response Rate</p>
                <p className="text-2xl font-bold">{reviewStats.responseRate}%</p>
              </div>
              <CheckCircle className="h-5 w-5 text-cyan-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Positive Sentiment</p>
                <p className="text-2xl font-bold">{reviewStats.sentimentBreakdown.positive}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-rose-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950 dark:to-violet-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Open Feedback</p>
                <p className="text-2xl font-bold">{feedbackStats.open}</p>
              </div>
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="reviews" className="space-y-6">
        <TabsList>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="feedback">Guest Feedback</TabsTrigger>
        </TabsList>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                {[5, 4, 3, 2, 1].map(r => (
                  <SelectItem key={r} value={r.toString()}>{r} Stars</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No reviews found</h3>
                <p className="text-muted-foreground">
                  {search || ratingFilter !== 'all' ? 'Try adjusting your filters' : 'Reviews will appear here as guests submit them'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map((review) => (
                <Card key={review.id} className="hover:shadow-md hover:bg-muted/20 transition-all duration-200 group">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4 md:items-start justify-between">
                      <div className="flex gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-medium shadow-md">
                          {review.guest.firstName[0]}{review.guest.lastName[0]}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{review.guest.firstName} {review.guest.lastName}</h4>
                            <Badge className={getSourceBadge(review.source)}>
                              {review.source.replace('_', '.')}
                            </Badge>
                            {review.sentimentLabel && (
                              <Badge className={cn(
                                'text-xs',
                                review.sentimentLabel === 'positive' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0',
                                review.sentimentLabel === 'neutral' && 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-0',
                                review.sentimentLabel === 'negative' && 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-0',
                              )}>
                                {review.sentimentLabel === 'positive' ? '😊' : review.sentimentLabel === 'negative' ? '😞' : '😐'} {review.sentimentLabel}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {renderStars(review.overallRating)}
                            <span className="text-sm text-muted-foreground">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {review.title && <p className="font-medium">{review.title}</p>}
                          <p className="text-sm text-muted-foreground">{review.comment}</p>
                          
                          {/* Rating Breakdown */}
                          <div className="flex flex-wrap gap-4 text-sm">
                            {review.cleanlinessRating && (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Cleanliness:</span>
                                {renderStars(review.cleanlinessRating)}
                              </div>
                            )}
                            {review.serviceRating && (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Service:</span>
                                {renderStars(review.serviceRating)}
                              </div>
                            )}
                            {review.locationRating && (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Location:</span>
                                {renderStars(review.locationRating)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <Button variant="outline" size="sm" onClick={() => {
                        setViewingReview(review);
                        setResponseText(review.responseText || '');
                      }} className="hover:shadow-md hover:bg-primary/5 transition-all duration-200">
                        <Eye className="h-4 w-4 mr-2" />
                        {review.responseText ? 'View Response' : 'Respond'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="complaint">Complaints</SelectItem>
                <SelectItem value="compliment">Compliments</SelectItem>
                <SelectItem value="suggestion">Suggestions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No feedback found</h3>
                <p className="text-muted-foreground">
                  {typeFilter !== 'all' ? 'Try adjusting your filters' : 'Guest feedback will appear here'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredFeedbacks.map((feedback) => (
                <Card key={feedback.id} className="hover:shadow-md hover:bg-muted/20 transition-all duration-200">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4 md:items-start justify-between">
                      <div className="flex gap-4">
                        <div className="rounded-lg bg-muted p-3 h-fit">
                          {getTypeIcon(feedback.type)}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{feedback.subject}</h4>
                            <Badge className={getPriorityColor(feedback.priority)}>
                              {feedback.priority}
                            </Badge>
                            <Badge className={getStatusColor(feedback.status)}>
                              {feedback.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{feedback.description}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{feedback.guest.firstName} {feedback.guest.lastName}</span>
                            <span>•</span>
                            <span className="capitalize">{feedback.category}</span>
                            <span>•</span>
                            <span>{new Date(feedback.createdAt).toLocaleDateString()}</span>
                          </div>
                          {feedback.resolution && (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950 rounded text-sm">
                              <span className="font-medium">Resolution: </span>
                              {feedback.resolution}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {feedback.status !== 'resolved' && feedback.status !== 'closed' && (
                        <Button variant="outline" size="sm" onClick={() => {
                          setViewingFeedback(feedback);
                          setResolutionText('');
                        }}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Review Response Dialog */}
      <Dialog open={!!viewingReview} onOpenChange={() => setViewingReview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Response</DialogTitle>
            <DialogDescription>
              Respond to {viewingReview?.guest.firstName}&apos;s review
            </DialogDescription>
          </DialogHeader>

          {viewingReview && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {renderStars(viewingReview.overallRating, 'md')}
                <span className="text-sm text-muted-foreground">
                  {viewingReview.title}
                </span>
              </div>
              <p className="text-sm">{viewingReview.comment}</p>
              
              <Separator />
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Response</label>
                <Textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Write your response..."
                  rows={4}
                  className="focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all duration-200"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingReview(null)}>Cancel</Button>
            <Button onClick={handleRespondToReview} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Resolution Dialog */}
      <Dialog open={!!viewingFeedback} onOpenChange={() => setViewingFeedback(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve Feedback</DialogTitle>
            <DialogDescription>
              Add resolution for: {viewingFeedback?.subject}
            </DialogDescription>
          </DialogHeader>

          {viewingFeedback && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{viewingFeedback.description}</p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution</label>
                <Textarea
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Describe how this was resolved..."
                  rows={4}
                  className="focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all duration-200"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingFeedback(null)}>Cancel</Button>
            <Button onClick={handleResolveFeedback} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
