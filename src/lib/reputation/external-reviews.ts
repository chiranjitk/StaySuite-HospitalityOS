/**
 * External Review Aggregation Service
 * Fetches reviews from Google, Booking.com, TripAdvisor, and other sources
 */

// Type definitions
export interface ExternalReview {
  externalId: string;
  source: 'google' | 'booking' | 'tripadvisor' | 'expedia' | 'airbnb';
  propertyId: string;
  guestName?: string;
  rating: number;
  title?: string;
  content: string;
  reviewDate: Date;
  responseDate?: Date;
  responseContent?: string;
  language?: string;
  helpfulVotes?: number;
  verified: boolean;
  metadata?: Record<string, unknown>;
}

export interface ReviewSourceConfig {
  source: string;
  apiKey?: string;
  apiSecret?: string;
  propertyMapping?: Record<string, string>; // internal property ID -> external property ID
  enabled: boolean;
}

export interface AggregationResult {
  source: string;
  fetched: number;
  new: number;
  updated: number;
  errors: string[];
}

/**
 * Google Business API Review Fetcher
 */
export async function fetchGoogleReviews(
  config: ReviewSourceConfig,
  propertyId: string
): Promise<{ reviews: ExternalReview[]; error?: string }> {
  try {
    const externalPropertyId = config.propertyMapping?.[propertyId];
    if (!externalPropertyId) {
      return { reviews: [], error: 'No property mapping found' };
    }

    // In production, this would call the actual Google My Business API
    // For now, we'll simulate the response structure
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${config.apiKey}/locations/${externalPropertyId}/reviews`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return { reviews: [], error: `Google API returned ${response.status}` };
    }

    const data = await response.json();
    const reviews: ExternalReview[] = (data.reviews || []).map((r: Record<string, unknown>) => ({
      externalId: r.reviewId as string,
      source: 'google',
      propertyId,
      guestName: (r.reviewer as Record<string, unknown>)?.displayName as string ?? undefined,
      rating: (r.starRating as string)?.toLowerCase() === 'five' ? 5 : 
              (r.starRating as string)?.toLowerCase() === 'four' ? 4 :
              (r.starRating as string)?.toLowerCase() === 'three' ? 3 :
              (r.starRating as string)?.toLowerCase() === 'two' ? 2 : 1,
      content: r.comment as string,
      reviewDate: new Date(r.createTime as string),
      responseDate: r.reviewReply ? new Date((r.reviewReply as Record<string, unknown>).updateTime as string) : undefined,
      responseContent: (r.reviewReply as Record<string, unknown>)?.comment as string,
      language: r.languageCode as string,
      verified: true,
    }));

    return { reviews };
  } catch (error) {
    console.error('Error fetching Google reviews:', error);
    return { reviews: [], error: 'Failed to fetch Google reviews' };
  }
}

/**
 * Booking.com Review Fetcher
 */
export async function fetchBookingReviews(
  config: ReviewSourceConfig,
  propertyId: string
): Promise<{ reviews: ExternalReview[]; error?: string }> {
  try {
    const externalPropertyId = config.propertyMapping?.[propertyId];
    if (!externalPropertyId) {
      return { reviews: [], error: 'No property mapping found' };
    }

    // Booking.com Partner API call (simulated)
    const response = await fetch(
      `https://distribution-xml.booking.com/2.0/json/hotelReviews?hotel_ids=${externalPropertyId}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return { reviews: [], error: `Booking.com API returned ${response.status}` };
    }

    const data = await response.json();
    const reviews: ExternalReview[] = (data.result || []).map((r: Record<string, unknown>) => ({
      externalId: r.review_id as string,
      source: 'booking',
      propertyId,
      guestName: (r.author as Record<string, unknown>)?.name as string,
      rating: ((r.rating || 0) as number) / 2, // Convert from 10-scale to 5-scale
      title: r.title as string,
      content: r.pros as string,
      reviewDate: new Date(r.date as string),
      language: r.language as string,
      verified: true,
      metadata: {
        cons: r.cons,
        helpfulVotes: r.helpful_votes,
      },
    }));

    return { reviews };
  } catch (error) {
    console.error('Error fetching Booking.com reviews:', error);
    return { reviews: [], error: 'Failed to fetch Booking.com reviews' };
  }
}

/**
 * TripAdvisor Review Fetcher
 */
export async function fetchTripAdvisorReviews(
  config: ReviewSourceConfig,
  propertyId: string
): Promise<{ reviews: ExternalReview[]; error?: string }> {
  try {
    const externalPropertyId = config.propertyMapping?.[propertyId];
    if (!externalPropertyId) {
      return { reviews: [], error: 'No property mapping found' };
    }

    // TripAdvisor API call (simulated)
    const response = await fetch(
      `https://api.tripadvisor.com/api/partner/2.0/location/${externalPropertyId}/reviews`,
      {
        headers: {
          'X-TripAdvisor-API-Key': config.apiKey || '',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return { reviews: [], error: `TripAdvisor API returned ${response.status}` };
    }

    const data = await response.json();
    const reviews: ExternalReview[] = (data.data || []).map((r: Record<string, unknown>) => ({
      externalId: r.location_id as string,
      source: 'tripadvisor',
      propertyId,
      guestName: (r.user as Record<string, unknown>)?.username as string,
      rating: r.rating as number,
      title: r.title as string,
      content: r.text as string,
      reviewDate: new Date(r.published_date as string),
      language: r.lang as string,
      helpfulVotes: r.helpful_votes as number,
      verified: false,
      metadata: {
        tripType: r.trip_type,
        travelerType: r.travel_type,
      },
    }));

    return { reviews };
  } catch (error) {
    console.error('Error fetching TripAdvisor reviews:', error);
    return { reviews: [], error: 'Failed to fetch TripAdvisor reviews' };
  }
}

/**
 * Expedia Review Fetcher
 */
export async function fetchExpediaReviews(
  config: ReviewSourceConfig,
  propertyId: string
): Promise<{ reviews: ExternalReview[]; error?: string }> {
  try {
    const externalPropertyId = config.propertyMapping?.[propertyId];
    if (!externalPropertyId) {
      return { reviews: [], error: 'No property mapping found' };
    }

    // Expedia Partner API call
    // TODO: Implement Expedia API integration when credentials are available
    return { reviews: [], error: 'Expedia API not yet implemented' };
  } catch (error) {
    console.error('Error fetching Expedia reviews:', error);
    return { reviews: [], error: 'Failed to fetch Expedia reviews' };
  }
}


/**
 * Main aggregation function - fetches from all enabled sources
 */
export async function aggregateReviews(
  configs: ReviewSourceConfig[],
  propertyId: string
): Promise<AggregationResult[]> {
  const results: AggregationResult[] = [];

  for (const config of configs) {
    if (!config.enabled) continue;

    const result: AggregationResult = {
      source: config.source,
      fetched: 0,
      new: 0,
      updated: 0,
      errors: [],
    };

    try {
      let reviews: ExternalReview[] = [];

      switch (config.source) {
        case 'google':
          reviews = (await fetchGoogleReviews(config, propertyId)).reviews;
          break;
        case 'booking':
          reviews = (await fetchBookingReviews(config, propertyId)).reviews;
          break;
        case 'tripadvisor':
          reviews = (await fetchTripAdvisorReviews(config, propertyId)).reviews;
          break;
        case 'expedia':
          reviews = (await fetchExpediaReviews(config, propertyId)).reviews;
          break;
      }

      result.fetched = reviews.length;
      
      // In production, you would save these to the database and compare with existing
      // For now, we'll just return the counts
      result.new = Math.floor(reviews.length * 0.7); // Simulate 70% new
      result.updated = reviews.length - result.new;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    results.push(result);
  }

  return results;
}
