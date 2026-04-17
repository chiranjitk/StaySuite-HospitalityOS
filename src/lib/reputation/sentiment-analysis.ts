/**
 * AI Sentiment Analysis Service
 * Analyzes reviews and feedback using LLM
 */

import ZAI from 'z-ai-web-dev-sdk';

// Type definitions
export interface SentimentResult {
  overall: 'positive' | 'negative' | 'neutral' | 'mixed';
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  aspects: AspectSentiment[];
  keywords: string[];
  emotions: EmotionScore[];
  summary: string;
  actionItems: string[];
}

export interface AspectSentiment {
  aspect: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  mentions: string[];
}

export interface EmotionScore {
  emotion: string;
  score: number;
}

// Aspect categories for hotel reviews
const HOTEL_ASPECTS = [
  'cleanliness',
  'service',
  'location',
  'value',
  'rooms',
  'food',
  'amenities',
  'staff',
  'check_in',
  'wifi',
  'noise',
  'parking',
  'price',
  'breakfast',
  'pool',
];

// System prompt for sentiment analysis
const SENTIMENT_SYSTEM_PROMPT = `You are an expert hotel review sentiment analyzer. Analyze the given review and provide:

1. Overall sentiment (positive/negative/neutral/mixed)
2. Sentiment score (-1 to 1, where -1 is very negative, 0 is neutral, 1 is very positive)
3. Confidence level (0 to 1)
4. Aspect-based sentiment analysis for relevant categories
5. Key keywords/topics mentioned
6. Emotions expressed (joy, anger, disappointment, satisfaction, frustration, excitement, etc.)
7. A brief summary (1-2 sentences)
8. Actionable items for hotel management

Respond in JSON format with this structure:
{
  "overall": "positive|negative|neutral|mixed",
  "score": 0.0,
  "confidence": 0.0,
  "aspects": [
    {"aspect": "category", "sentiment": "positive|negative|neutral", "score": 0.0, "mentions": ["specific phrases"]}
  ],
  "keywords": ["keyword1", "keyword2"],
  "emotions": [{"emotion": "name", "score": 0.0}],
  "summary": "Brief summary",
  "actionItems": ["action 1", "action 2"]
}

Be thorough and identify all aspects mentioned, even briefly.`;

/**
 * Analyze sentiment of a single review
 */
export async function analyzeReviewSentiment(
  reviewText: string,
  reviewRating?: number
): Promise<SentimentResult> {
  try {
    // Use LLM SDK for sentiment analysis
    const zai = await ZAI.create();
    
    const response = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SENTIMENT_SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `Analyze this hotel review:\n\nRating: ${reviewRating || 'Not provided'}/5\n\nReview: "${reviewText}"` 
        },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        overall: parsed.overall || 'neutral',
        score: parsed.score || 0,
        confidence: parsed.confidence || 0.5,
        aspects: parsed.aspects || [],
        keywords: parsed.keywords || [],
        emotions: parsed.emotions || [],
        summary: parsed.summary || '',
        actionItems: parsed.actionItems || [],
      };
    }

    // Fallback to rule-based analysis
    return fallbackSentimentAnalysis(reviewText, reviewRating);
  } catch (error) {
    console.error('Error in AI sentiment analysis:', error);
    // Fallback to rule-based analysis
    return fallbackSentimentAnalysis(reviewText, reviewRating);
  }
}

/**
 * Rule-based fallback sentiment analysis
 */
function fallbackSentimentAnalysis(
  reviewText: string,
  reviewRating?: number
): SentimentResult {
  const text = reviewText.toLowerCase();
  
  // Positive and negative word lists
  const positiveWords = [
    'excellent', 'amazing', 'wonderful', 'fantastic', 'great', 'love', 'perfect',
    'beautiful', 'clean', 'comfortable', 'friendly', 'helpful', 'superb', 'outstanding',
    'delightful', 'impressive', 'spacious', 'relaxing', 'enjoyed', 'recommend',
  ];
  
  const negativeWords = [
    'terrible', 'awful', 'horrible', 'bad', 'poor', 'dirty', 'disappointing',
    'uncomfortable', 'rude', 'noisy', 'broken', 'overpriced', 'worst', 'disgusting',
    'unacceptable', 'avoid', 'regret', 'complaint', 'issue', 'problem',
  ];

  // Count sentiment words
  let positiveCount = 0;
  let negativeCount = 0;
  const positiveMatches: string[] = [];
  const negativeMatches: string[] = [];

  positiveWords.forEach((word) => {
    if (text.includes(word)) {
      positiveCount++;
      positiveMatches.push(word);
    }
  });

  negativeWords.forEach((word) => {
    if (text.includes(word)) {
      negativeCount++;
      negativeMatches.push(word);
    }
  });

  // Calculate base score
  let score = 0;
  const totalWords = positiveCount + negativeCount;
  if (totalWords > 0) {
    score = (positiveCount - negativeCount) / Math.max(totalWords, 5);
  }

  // Factor in rating if provided
  if (reviewRating !== undefined) {
    const ratingScore = (reviewRating - 3) / 2; // Normalize to -1 to 1
    score = score * 0.3 + ratingScore * 0.7;
  }

  // Determine overall sentiment
  let overall: SentimentResult['overall'];
  if (score >= 0.3) overall = 'positive';
  else if (score <= -0.3) overall = 'negative';
  else if (Math.abs(score) < 0.1) overall = 'neutral';
  else overall = 'mixed';

  // Extract aspects
  const aspects: AspectSentiment[] = [];
  HOTEL_ASPECTS.forEach((aspect) => {
    const aspectKeywords = getAspectKeywords(aspect);
    const mentions: string[] = [];
    let aspectScore = 0;

    aspectKeywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        mentions.push(keyword);
        // Check context for sentiment
        const regex = new RegExp(`.{0,30}${keyword}.{0,30}`, 'gi');
        const matches = text.match(regex);
        if (matches) {
          matches.forEach((match) => {
            positiveWords.forEach((pw) => {
              if (match.includes(pw)) aspectScore += 0.2;
            });
            negativeWords.forEach((nw) => {
              if (match.includes(nw)) aspectScore -= 0.2;
            });
          });
        }
      }
    });

    if (mentions.length > 0) {
      aspects.push({
        aspect,
        sentiment: aspectScore > 0.1 ? 'positive' : aspectScore < -0.1 ? 'negative' : 'neutral',
        score: Math.max(-1, Math.min(1, aspectScore)),
        mentions,
      });
    }
  });

  // Extract keywords
  const keywords = [...positiveMatches, ...negativeMatches].slice(0, 10);

  // Generate emotions
  const emotions: EmotionScore[] = [];
  if (positiveCount > negativeCount) {
    emotions.push({ emotion: 'satisfaction', score: Math.min(1, positiveCount / 5) });
    if (score > 0.5) emotions.push({ emotion: 'joy', score: Math.min(1, score) });
  } else if (negativeCount > positiveCount) {
    emotions.push({ emotion: 'disappointment', score: Math.min(1, negativeCount / 5) });
    if (score < -0.5) emotions.push({ emotion: 'frustration', score: Math.min(1, Math.abs(score)) });
  }

  // Generate summary
  const summary = `${overall.charAt(0).toUpperCase() + overall.slice(1)} review mentioning: ${keywords.slice(0, 3).join(', ')}`;

  // Generate action items
  const actionItems: string[] = [];
  aspects.filter((a) => a.sentiment === 'negative').forEach((a) => {
    actionItems.push(`Address concerns about ${a.aspect}`);
  });

  return {
    overall,
    score,
    confidence: 0.6 + Math.abs(score) * 0.3,
    aspects,
    keywords,
    emotions,
    summary,
    actionItems,
  };
}

/**
 * Get keywords associated with each aspect
 */
function getAspectKeywords(aspect: string): string[] {
  const keywordMap: Record<string, string[]> = {
    cleanliness: ['clean', 'dirty', 'spotless', 'hygiene', 'sanitary', 'tidy', 'messy'],
    service: ['service', 'staff', 'reception', 'concierge', 'helpful', 'rude', 'friendly'],
    location: ['location', 'area', 'neighborhood', 'distance', 'central', 'convenient', 'far'],
    value: ['value', 'price', 'worth', 'expensive', 'cheap', 'overpriced', 'affordable'],
    rooms: ['room', 'bedroom', 'suite', 'spacious', 'small', 'comfortable', 'bed'],
    food: ['food', 'breakfast', 'dinner', 'restaurant', 'meal', 'buffet', 'cuisine'],
    amenities: ['amenities', 'facilities', 'gym', 'spa', 'pool', 'parking', 'lounge'],
    staff: ['staff', 'employee', 'manager', 'housekeeping', 'receptionist', 'team'],
    check_in: ['check-in', 'check in', 'arrival', 'reception', 'registration', 'welcome'],
    wifi: ['wifi', 'internet', 'connection', 'signal', 'speed', 'online'],
    noise: ['noise', 'quiet', 'loud', 'sound', 'peaceful', 'disturbance'],
    parking: ['parking', 'car', 'vehicle', 'garage', 'valet'],
    price: ['price', 'cost', 'rate', 'fee', 'charge', 'expensive', 'cheap'],
    breakfast: ['breakfast', 'morning', 'buffet', 'eggs', 'coffee', 'continental'],
    pool: ['pool', 'swimming', 'spa', 'water', 'jacuzzi', 'gym'],
  };
  
  return keywordMap[aspect] || [aspect];
}

/**
 * Batch analyze multiple reviews
 */
export async function batchAnalyzeReviews(
  reviews: Array<{ id: string; text: string; rating?: number }>
): Promise<Array<{ id: string; sentiment: SentimentResult }>> {
  const results: Array<{ id: string; sentiment: SentimentResult }> = [];
  
  for (const review of reviews) {
    try {
      const sentiment = await analyzeReviewSentiment(review.text, review.rating);
      results.push({ id: review.id, sentiment });
    } catch (error) {
      console.error(`Error analyzing review ${review.id}:`, error);
      results.push({
        id: review.id,
        sentiment: fallbackSentimentAnalysis(review.text, review.rating),
      });
    }
  }
  
  return results;
}

/**
 * Calculate aggregate sentiment statistics
 */
export function calculateAggregateSentiment(
  sentiments: SentimentResult[]
): {
  averageScore: number;
  sentimentDistribution: Record<string, number>;
  topPositiveAspects: Array<{ aspect: string; avgScore: number; count: number }>;
  topNegativeAspects: Array<{ aspect: string; avgScore: number; count: number }>;
  commonKeywords: Array<{ keyword: string; count: number }>;
  topActionItems: Array<{ item: string; count: number }>;
} {
  if (sentiments.length === 0) {
    return {
      averageScore: 0,
      sentimentDistribution: {},
      topPositiveAspects: [],
      topNegativeAspects: [],
      commonKeywords: [],
      topActionItems: [],
    };
  }

  // Average score
  const averageScore = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;

  // Sentiment distribution
  const sentimentDistribution: Record<string, number> = {};
  sentiments.forEach((s) => {
    sentimentDistribution[s.overall] = (sentimentDistribution[s.overall] || 0) + 1;
  });

  // Aggregate aspects
  const aspectScores: Record<string, { total: number; count: number }> = {};
  sentiments.forEach((s) => {
    s.aspects.forEach((a) => {
      if (!aspectScores[a.aspect]) {
        aspectScores[a.aspect] = { total: 0, count: 0 };
      }
      aspectScores[a.aspect].total += a.score;
      aspectScores[a.aspect].count++;
    });
  });

  const aspectsWithAvg = Object.entries(aspectScores).map(([aspect, data]) => ({
    aspect,
    avgScore: data.total / data.count,
    count: data.count,
  }));

  const topPositiveAspects = aspectsWithAvg
    .filter((a) => a.avgScore > 0)
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5);

  const topNegativeAspects = aspectsWithAvg
    .filter((a) => a.avgScore < 0)
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 5);

  // Aggregate keywords
  const keywordCounts: Record<string, number> = {};
  sentiments.forEach((s) => {
    s.keywords.forEach((k) => {
      keywordCounts[k] = (keywordCounts[k] || 0) + 1;
    });
  });

  const commonKeywords = Object.entries(keywordCounts)
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Aggregate action items
  const actionCounts: Record<string, number> = {};
  sentiments.forEach((s) => {
    s.actionItems.forEach((item) => {
      actionCounts[item] = (actionCounts[item] || 0) + 1;
    });
  });

  const topActionItems = Object.entries(actionCounts)
    .map(([item, count]) => ({ item, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    averageScore,
    sentimentDistribution,
    topPositiveAspects,
    topNegativeAspects,
    commonKeywords,
    topActionItems,
  };
}
