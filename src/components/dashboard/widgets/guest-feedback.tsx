'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Star,
  MessageSquare,
  ThumbsUp,
  Minus,
  ThumbsDown,
  TrendingUp,
  Quote,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Review {
  guestName: string;
  room: string;
  rating: number;
  comment: string;
}

interface FeedbackData {
  overallScore: number;
  totalReviews: number;
  positive: number;
  neutral: number;
  negative: number;
  trend: number;
  reviews: Review[];
}

function getMockData(): FeedbackData {
  return {
    overallScore: 4.6,
    totalReviews: 156,
    positive: 78,
    neutral: 15,
    negative: 7,
    trend: 0.2,
    reviews: [
      { guestName: 'Mr. Kapoor', room: 'Suite 501', rating: 5, comment: 'Excellent service and luxurious amenities' },
      { guestName: 'Ms. Reddy', room: 'Room 302', rating: 4, comment: 'Comfortable stay, great breakfast spread' },
      { guestName: 'Mr. Chen', room: 'Room 215', rating: 4, comment: 'Good value for money, friendly staff' },
    ],
  };
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const starSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={cn(
            starSize,
            star <= rating
              ? 'text-amber-400 fill-amber-400'
              : star - 0.5 <= rating
                ? 'text-amber-400 fill-amber-200'
                : 'text-muted/30'
          )}
        />
      ))}
    </div>
  );
}

export default function GuestFeedbackWidget() {
  const [data, setData] = useState<FeedbackData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setData(getMockData());
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="h-5 w-40 bg-muted/30 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted/20 animate-pulse rounded" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Accent bar */}
      <div className="h-[2px] bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-600" />
            Guest Feedback
          </CardTitle>
          <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400">
            {data.totalReviews} reviews
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Score + trend */}
        <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-100/50 dark:border-amber-800/30">
          <div className="text-center">
            <p className="text-3xl font-extrabold text-amber-600 tabular-nums">{data.overallScore}</p>
            <StarRating rating={Math.round(data.overallScore)} size="sm" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Overall Satisfaction</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-600">+{data.trend}</span>
              <span className="text-[10px] text-muted-foreground">vs last week</span>
            </div>
          </div>
        </div>

        {/* Sentiment breakdown */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Sentiment Breakdown</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-3 w-3 text-emerald-600 flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground w-12">Positive</span>
              <div className="flex-1 h-2 bg-muted/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${data.positive}%` }}
                  transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 tabular-nums w-8 text-right">{data.positive}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Minus className="h-3 w-3 text-sky-600 flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground w-12">Neutral</span>
              <div className="flex-1 h-2 bg-muted/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-sky-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${data.neutral}%` }}
                  transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
                />
              </div>
              <span className="text-[10px] font-bold text-sky-600 tabular-nums w-8 text-right">{data.neutral}%</span>
            </div>
            <div className="flex items-center gap-2">
              <ThumbsDown className="h-3 w-3 text-rose-600 flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground w-12">Negative</span>
              <div className="flex-1 h-2 bg-muted/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-rose-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${data.negative}%` }}
                  transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
                />
              </div>
              <span className="text-[10px] font-bold text-rose-600 tabular-nums w-8 text-right">{data.negative}%</span>
            </div>
          </div>
        </div>

        {/* Recent reviews */}
        <div className="space-y-2 pt-2 border-t border-border/30">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Recent Reviews</p>
          {data.reviews.map((review, i) => (
            <motion.div
              key={review.guestName}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 + 0.5 }}
              className="p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Quote className="h-2.5 w-2.5 text-amber-600" />
                  </div>
                  <span className="text-xs font-medium">{review.guestName}</span>
                </div>
                <StarRating rating={review.rating} size="sm" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{review.comment}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">{review.room}</p>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
