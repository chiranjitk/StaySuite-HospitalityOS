'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Star,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Filter,
  Search,
  RefreshCw,
  Loader2,
  ExternalLink,
  Calendar,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';

interface Review {
  id: string;
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
    firstName: string;
    lastName: string;
    email: string | null;
  };
}

interface ReviewStats {
  total: number;
  averageRating: number;
  ratingDistribution: Record<string, number>;
  categoryAverages: {
    cleanliness: number;
    service: number;
    location: number;
    value: number;
  };
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  sourceDistribution: Record<string, number>;
  responseRate: number;
}

interface ReviewsResponse {
  reviews: Review[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: ReviewStats;
}

export default function ReputationDashboard() {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [respondDialog, setRespondDialog] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sourceFilter !== 'all') params.append('source', sourceFilter);
      if (sentimentFilter !== 'all') params.append('sentiment', sentimentFilter);
      if (ratingFilter !== 'all') params.append('rating', ratingFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/reputation/reviews?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch reviews');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [sourceFilter, sentimentFilter, ratingFilter, searchTerm]);

  const handleRespond = async () => {
    if (!selectedReview || !responseText.trim()) return;
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/reputation/reviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId: selectedReview.id,
          responseText,
          respondedBy: 'staff',
        }),
      });

      if (!res.ok) throw new Error('Failed to respond');
      
      toast.success('Response submitted successfully');
      setRespondDialog(false);
      setSelectedReview(null);
      setResponseText('');
      fetchReviews();
    } catch (error) {
      console.error('Error responding to review:', error);
      toast.error('Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'text-yellow-400 dark:text-yellow-300 fill-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const getSentimentBadge = (label: string | null, score: number | null) => {
    if (!label) return null;
    
    const colors = {
      positive: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
      neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      negative: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    };

    const icons = {
      positive: <ThumbsUp className="h-3 w-3 mr-1" />,
      neutral: null,
      negative: <ThumbsDown className="h-3 w-3 mr-1" />,
    };

    return (
      <Badge variant="secondary" className={colors[label as keyof typeof colors]}>
        {icons[label as keyof typeof icons]}
        {label.charAt(0).toUpperCase() + label.slice(1)}
        {score !== null && ` (${(score * 100).toFixed(0)}%)`}
      </Badge>
    );
  };

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      internal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
      google: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
      booking_com: 'bg-blue-600 text-white',
      tripadvisor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
      expedia: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
    };

    const labels: Record<string, string> = {
      internal: 'Internal',
      google: 'Google',
      booking_com: 'Booking.com',
      tripadvisor: 'TripAdvisor',
      expedia: 'Expedia',
    };

    return (
      <Badge variant="secondary" className={colors[source] || 'bg-gray-100'}>
        {labels[source] || source}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reputation Management</h2>
          <p className="text-muted-foreground">
            Monitor and respond to reviews from all sources
          </p>
        </div>
        <Button onClick={() => fetchReviews()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.total}</div>
            <p className="text-xs text-muted-foreground">Across all platforms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-400 dark:text-yellow-300 fill-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.averageRating.toFixed(1)}</div>
            <div className="flex items-center mt-1">
              {renderStars(Math.round(data.stats.averageRating))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.responseRate.toFixed(1)}%</div>
            <Progress value={data.stats.responseRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sentiment Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {data.stats.sentimentDistribution.positive > data.stats.sentimentDistribution.negative ? 'Positive' : 'Needs Attention'}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.stats.sentimentDistribution.positive} positive, {data.stats.sentimentDistribution.negative} negative
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution & Category Scores */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>Breakdown of ratings across all reviews</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = data.stats.ratingDistribution[rating] || 0;
                const percentage = data.stats.total > 0 ? (count / data.stats.total) * 100 : 0;
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <span className="w-8 text-sm font-medium">{rating}★</span>
                    <Progress value={percentage} className="flex-1" />
                    <span className="w-8 text-sm text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Scores</CardTitle>
            <CardDescription>Average ratings by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'Cleanliness', value: data.stats.categoryAverages.cleanliness },
                { label: 'Service', value: data.stats.categoryAverages.service },
                { label: 'Location', value: data.stats.categoryAverages.location },
                { label: 'Value', value: data.stats.categoryAverages.value },
              ].map((category) => (
                <div key={category.label} className="flex items-center justify-between">
                  <span className="text-sm">{category.label}</span>
                  <div className="flex items-center gap-2">
                    {renderStars(Math.round(category.value))}
                    <span className="text-sm font-medium">{category.value.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label className="sr-only">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reviews..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="booking_com">Booking.com</SelectItem>
                <SelectItem value="tripadvisor">TripAdvisor</SelectItem>
                <SelectItem value="expedia">Expedia</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sentiment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiments</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reviews</CardTitle>
          <CardDescription>
            Showing {data.reviews.length} of {data.pagination.total} reviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-4">
              {data.reviews.map((review) => (
                <div
                  key={review.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {review.guest.firstName} {review.guest.lastName}
                        </span>
                        {getSourceBadge(review.source)}
                        {getSentimentBadge(review.sentimentLabel, review.sentimentScore)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(review.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderStars(review.overallRating)}
                      <span className="font-medium">{review.overallRating}</span>
                    </div>
                  </div>

                  {review.title && (
                    <h4 className="font-medium">{review.title}</h4>
                  )}

                  {review.comment && (
                    <p className="text-sm text-muted-foreground">
                      {review.comment}
                    </p>
                  )}

                  {/* Category Ratings */}
                  {(review.cleanlinessRating || review.serviceRating || review.locationRating || review.valueRating) && (
                    <div className="flex flex-wrap gap-4 text-sm">
                      {review.cleanlinessRating && (
                        <span>Cleanliness: {review.cleanlinessRating}★</span>
                      )}
                      {review.serviceRating && (
                        <span>Service: {review.serviceRating}★</span>
                      )}
                      {review.locationRating && (
                        <span>Location: {review.locationRating}★</span>
                      )}
                      {review.valueRating && (
                        <span>Value: {review.valueRating}★</span>
                      )}
                    </div>
                  )}

                  {/* Response */}
                  {review.responseText ? (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400">
                        <Building2 className="h-4 w-4" />
                        Property Response
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {review.responseText}
                      </p>
                      {review.respondedAt && (
                        <p className="text-xs text-muted-foreground">
                          Responded on {new Date(review.respondedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedReview(review);
                        setRespondDialog(true);
                      }}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Respond
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Response Dialog */}
      <Dialog open={respondDialog} onOpenChange={setRespondDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Review</DialogTitle>
            <DialogDescription>
              Write a response to this guest review
            </DialogDescription>
          </DialogHeader>
          
          {selectedReview && (
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {selectedReview.guest.firstName} {selectedReview.guest.lastName}
                </span>
                {renderStars(selectedReview.overallRating)}
              </div>
              {selectedReview.comment && (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded p-3">
                  {selectedReview.comment}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="response">Your Response</Label>
                <Textarea
                  id="response"
                  placeholder="Write your response here..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRespond} 
              disabled={!responseText.trim() || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
