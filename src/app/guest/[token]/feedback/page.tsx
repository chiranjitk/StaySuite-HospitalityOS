'use client';

import React, { useState, useEffect } from 'react';
import { useGuestApp } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Star,
  MessageSquare,
  ThumbsUp,
  AlertTriangle,
  Lightbulb,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface FeedbackItem {
  id: string;
  type: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  resolvedAt?: string;
  resolution?: string;
  createdAt: string;
}

interface ReviewData {
  id: string;
  overallRating: number;
  cleanlinessRating?: number;
  serviceRating?: number;
  locationRating?: number;
  valueRating?: number;
  title?: string;
  comment?: string;
  createdAt: string;
}

export default function FeedbackPage() {
  const { data: guestData, isLoading: guestLoading } = useGuestApp();
  const { toast } = useToast();

  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [existingReview, setExistingReview] = useState<ReviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [feedbackForm, setFeedbackForm] = useState({
    type: 'compliment',
    category: 'service',
    subject: '',
    description: '',
  });

  const [reviewForm, setReviewForm] = useState({
    overallRating: 5,
    cleanlinessRating: 5,
    serviceRating: 5,
    locationRating: 5,
    valueRating: 5,
    title: '',
    comment: '',
  });

  // Fetch feedback data
  useEffect(() => {
    const fetchFeedback = async () => {
      if (!guestData) return;

      setIsLoading(true);
      try {
        const token = window.location.pathname.split('/')[2];
        const response = await fetch(`/api/guest-app/feedback?token=${token}`);
        const result = await response.json();

        if (result.success) {
          setFeedbackList(result.data.feedback);
          if (result.data.reviews.length > 0) {
            setExistingReview(result.data.reviews[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching feedback:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, [guestData]);

  // Submit feedback
  const handleSubmitFeedback = async () => {
    if (!feedbackForm.subject || !feedbackForm.description) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = window.location.pathname.split('/')[2];
      const response = await fetch('/api/guest-app/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          type: 'feedback',
          feedbackType: feedbackForm.type,
          category: feedbackForm.category,
          subject: feedbackForm.subject,
          description: feedbackForm.description,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Feedback Submitted',
          description: 'Thank you for your feedback!',
        });
        setIsFeedbackDialogOpen(false);
        setFeedbackForm({
          type: 'compliment',
          category: 'service',
          subject: '',
          description: '',
        });
        // Refresh feedback list
        setFeedbackList(prev => [{
          id: result.data.id,
          type: feedbackForm.type,
          category: feedbackForm.category,
          subject: feedbackForm.subject,
          description: feedbackForm.description,
          status: 'open',
          priority: 'medium',
          createdAt: result.data.createdAt,
        }, ...prev]);
      } else {
        throw new Error(result.error?.message || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit feedback',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit review
  const handleSubmitReview = async () => {
    setIsSubmitting(true);
    try {
      const token = window.location.pathname.split('/')[2];
      const response = await fetch('/api/guest-app/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          type: 'review',
          ...reviewForm,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Review Submitted',
          description: 'Thank you for your review!',
        });
        setIsReviewDialogOpen(false);
        setExistingReview({
          id: result.data.id,
          ...reviewForm,
          createdAt: result.data.createdAt,
        });
      } else {
        throw new Error(result.error?.message || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit review',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Star rating component
  const StarRating = ({
    value,
    onChange,
    readonly = false,
    size = 'md',
  }: {
    value: number;
    onChange?: (value: number) => void;
    readonly?: boolean;
    size?: 'sm' | 'md' | 'lg';
  }) => {
    const sizes = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    };

    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star)}
            className={cn(
              'focus:outline-none transition-colors',
              readonly && 'cursor-default',
              !readonly && 'hover:scale-110 transition-transform'
            )}
          >
            <Star
              className={cn(
                sizes[size],
                star <= value
                  ? 'text-amber-400 dark:text-amber-300 fill-amber-400'
                  : 'text-slate-300 dark:text-slate-600'
              )}
            />
          </button>
        ))}
      </div>
    );
  };

  // Feedback type config
  const feedbackTypes = [
    { value: 'compliment', label: 'Compliment', icon: ThumbsUp, color: 'text-emerald-500 dark:text-emerald-400' },
    { value: 'complaint', label: 'Complaint', icon: AlertTriangle, color: 'text-red-500 dark:text-red-400' },
    { value: 'suggestion', label: 'Suggestion', icon: Lightbulb, color: 'text-amber-500 dark:text-amber-400' },
  ];

  const feedbackCategories = [
    'service',
    'room',
    'food',
    'facilities',
    'staff',
    'cleanliness',
    'other',
  ];

  // Loading state
  if (guestLoading || isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!guestData) {
    return null;
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-semibold">Share Your Experience</h2>
        <p className="text-sm text-muted-foreground">
          Your feedback helps us improve our service
        </p>
      </div>

      {/* Review Card */}
      {existingReview ? (
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Your Review</CardTitle>
              <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <StarRating value={existingReview.overallRating} readonly size="sm" />
                <span className="text-sm font-medium">
                  {existingReview.overallRating}/5
                </span>
              </div>

              {existingReview.comment && (
                <p className="text-sm text-muted-foreground">
                  "{existingReview.comment}"
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Submitted {formatDistanceToNow(new Date(existingReview.createdAt), { addSuffix: true })}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-sky-950/30 dark:to-indigo-950/30 border-sky-200 dark:border-sky-800">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mx-auto mb-4">
              <Star className="h-8 w-8 text-sky-600 dark:text-sky-400" />
            </div>
            <h3 className="font-semibold mb-2">Rate Your Stay</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Share your experience and help other travelers
            </p>
            <Button onClick={() => setIsReviewDialogOpen(true)}>
              Write a Review
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        {feedbackTypes.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.value}
              onClick={() => {
                setFeedbackForm(prev => ({ ...prev, type: type.value }));
                setIsFeedbackDialogOpen(true);
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <Icon className={cn('h-6 w-6', type.color)} />
              <span className="text-xs font-medium">{type.label}</span>
            </button>
          );
        })}
      </div>

      {/* Previous Feedback */}
      {feedbackList.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Your Feedback</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[300px]">
              {feedbackList.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{item.subject}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {item.type} • {item.category}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        item.status === 'resolved' && 'border-emerald-500 text-emerald-600 dark:text-emerald-400',
                        item.status === 'open' && 'border-amber-500 text-amber-600 dark:text-amber-400',
                        item.status === 'in_progress' && 'border-sky-500 text-sky-600 dark:text-sky-400'
                      )}
                    >
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                    {item.resolution && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Resolved
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Feedback Dialog */}
      <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="capitalize">
              Submit {feedbackForm.type}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <div className="flex gap-2 mt-2">
                {feedbackTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFeedbackForm(prev => ({ ...prev, type: type.value }))}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors',
                        feedbackForm.type === type.value
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30'
                          : 'border-slate-200 dark:border-slate-700'
                      )}
                    >
                      <Icon className={cn('h-4 w-4', type.color)} />
                      <span className="text-xs">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Category</Label>
              <Select
                value={feedbackForm.category}
                onValueChange={(value) => setFeedbackForm(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {feedbackCategories.map(cat => (
                    <SelectItem key={cat} value={cat} className="capitalize">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Subject</Label>
              <Input
                placeholder="Brief summary"
                value={feedbackForm.subject}
                onChange={(e) => setFeedbackForm(prev => ({ ...prev, subject: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Details</Label>
              <Textarea
                placeholder="Tell us more about your experience..."
                value={feedbackForm.description}
                onChange={(e) => setFeedbackForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFeedbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitFeedback} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Overall Rating */}
            <div>
              <Label className="text-base">Overall Rating</Label>
              <div className="flex items-center justify-center gap-2 mt-2">
                <StarRating
                  value={reviewForm.overallRating}
                  onChange={(value) => setReviewForm(prev => ({ ...prev, overallRating: value }))}
                  size="lg"
                />
                <span className="text-xl font-bold">{reviewForm.overallRating}/5</span>
              </div>
            </div>

            {/* Category Ratings */}
            <div className="space-y-3">
              {[
                { key: 'cleanlinessRating', label: 'Cleanliness' },
                { key: 'serviceRating', label: 'Service' },
                { key: 'locationRating', label: 'Location' },
                { key: 'valueRating', label: 'Value' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <StarRating
                    value={reviewForm[key as keyof typeof reviewForm] as number}
                    onChange={(value) => setReviewForm(prev => ({ ...prev, [key]: value }))}
                    size="sm"
                  />
                </div>
              ))}
            </div>

            <div>
              <Label>Title (Optional)</Label>
              <Input
                placeholder="Summarize your experience"
                value={reviewForm.title}
                onChange={(e) => setReviewForm(prev => ({ ...prev, title: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Your Review</Label>
              <Textarea
                placeholder="What did you like or dislike?"
                value={reviewForm.comment}
                onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReview} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
