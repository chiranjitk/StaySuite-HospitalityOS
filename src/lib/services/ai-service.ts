/**
 * StaySuite AI Service
 * 
 * Centralized AI service for all LLM operations with:
 * - Real-time AI insights generation
 * - Context building from database
 * - Caching for repeated queries
 * - Rate limiting support
 * - Fallback to rule-based logic
 */

import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

// Types
export interface AIContext {
  tenantId: string;
  propertyId?: string;
  userId?: string;
  userRole?: string;
  language?: string;
}

export interface InsightData {
  category: 'revenue' | 'operations' | 'guest' | 'pricing' | 'marketing';
  type: 'opportunity' | 'alert' | 'recommendation' | 'prediction' | 'insight';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  potentialRevenue?: number;
  confidence: number;
  action?: string;
  data?: Record<string, unknown>;
}

export interface CopilotContext {
  occupancy?: {
    current: number;
    total: number;
    rate: number;
  };
  todaysCheckIns?: number;
  todaysCheckOuts?: number;
  pendingTasks?: number;
  revenue?: {
    today: number;
    month: number;
    trend: number;
  };
  alerts?: Array<{
    type: string;
    message: string;
  }>;
}

export interface DatabaseContext {
  bookings: Array<Record<string, unknown>>;
  rooms: Array<Record<string, unknown>>;
  guests: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  revenue: {
    today: number;
    week: number;
    month: number;
    trend: number;
  };
  occupancy: {
    current: number;
    total: number;
    rate: number;
  };
}

// Cache for repeated queries
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class AIService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private rateLimitTracker: Map<string, number[]> = new Map();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX = 30; // 30 requests per minute

  /**
   * Get cached data if valid
   */
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache entry
   */
  private setCache<T>(key: string, data: T, ttlMs: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  /**
   * Check rate limit for tenant
   */
  private checkRateLimit(tenantId: string): boolean {
    const now = Date.now();
    const requests = this.rateLimitTracker.get(tenantId) || [];
    
    // Clean old requests
    const recentRequests = requests.filter(time => now - time < this.RATE_LIMIT_WINDOW);
    
    if (recentRequests.length >= this.RATE_LIMIT_MAX) {
      return false;
    }

    recentRequests.push(now);
    this.rateLimitTracker.set(tenantId, recentRequests);
    return true;
  }

  /**
   * Build database context for AI
   */
  async buildDatabaseContext(context: AIContext): Promise<DatabaseContext> {
    const cacheKey = `context-${context.tenantId}`;
    const cached = this.getCached<DatabaseContext>(cacheKey);
    if (cached) return cached;

    const { tenantId, propertyId } = context;

    // Get bookings
    const bookings = await db.booking.findMany({
      where: {
        tenantId,
        ...(propertyId ? { propertyId } : {}),
      },
      select: {
        id: true,
        status: true,
        checkIn: true,
        checkOut: true,
        totalAmount: true,
        roomRate: true,
        adults: true,
        children: true,
        source: true,
        createdAt: true,
        room: {
          select: {
            number: true,
            roomType: { select: { name: true, basePrice: true } },
          },
        },
        primaryGuest: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            loyaltyTier: true,
            isVip: true,
          },
        },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    // Get rooms
    const rooms = await db.room.findMany({
      where: propertyId
        ? { propertyId }
        : {
            roomType: {
              property: { tenantId },
            },
          },
      select: {
        id: true,
        number: true,
        status: true,
        floor: true,
        roomType: {
          select: {
            name: true,
            basePrice: true,
            maxOccupancy: true,
          },
        },
      },
    });

    // Get guests
    const guests = await db.guest.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        loyaltyTier: true,
        totalStays: true,
        totalSpent: true,
        isVip: true,
        source: true,
        createdAt: true,
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    // Get tasks
    const tasks = await db.task.findMany({
      where: { tenantId },
      select: {
        id: true,
        type: true,
        category: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        completedAt: true,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    // Calculate revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const twoMonthsAgo = new Date(today);
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);

    const [todayPayments, monthPayments, lastMonthPayments] = await Promise.all([
      db.payment.findMany({
        where: {
          tenantId,
          status: 'completed',
          createdAt: { gte: today },
        },
        select: { amount: true },
      }),
      db.payment.findMany({
        where: {
          tenantId,
          status: 'completed',
          createdAt: { gte: monthAgo },
        },
        select: { amount: true },
      }),
      db.payment.findMany({
        where: {
          tenantId,
          status: 'completed',
          createdAt: { gte: twoMonthsAgo, lt: monthAgo },
        },
        select: { amount: true },
      }),
    ]);

    const todayRevenue = todayPayments.reduce((sum, p) => sum + p.amount, 0);
    const monthRevenue = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    const lastMonthRevenue = lastMonthPayments.reduce((sum, p) => sum + p.amount, 0);
    const revenueTrend = lastMonthRevenue > 0
      ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    // Calculate occupancy
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const occupancyRate = rooms.length > 0 ? (occupiedRooms / rooms.length) * 100 : 0;

    const dbContext: DatabaseContext = {
      bookings: bookings.map(b => ({
        id: b.id,
        status: b.status,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        totalAmount: b.totalAmount,
        roomRate: b.roomRate,
        guestName: b.primaryGuest ? `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}` : 'Unknown',
        roomNumber: b.room?.number,
        roomType: b.room?.roomType?.name,
      })),
      rooms: rooms.map(r => ({
        id: r.id,
        number: r.number,
        status: r.status,
        floor: r.floor,
        roomType: r.roomType?.name,
        basePrice: r.roomType?.basePrice,
      })),
      guests: guests.map(g => ({
        id: g.id,
        name: `${g.firstName} ${g.lastName}`,
        email: g.email,
        loyaltyTier: g.loyaltyTier,
        totalStays: g.totalStays,
        totalSpent: g.totalSpent,
        isVip: g.isVip,
      })),
      tasks: tasks.map(t => ({
        id: t.id,
        type: t.type,
        category: t.category,
        title: t.title,
        status: t.status,
        priority: t.priority,
      })),
      revenue: {
        today: todayRevenue,
        week: monthRevenue / 4,
        month: monthRevenue,
        trend: revenueTrend,
      },
      occupancy: {
        current: occupiedRooms,
        total: rooms.length,
        rate: occupancyRate,
      },
    };

    // Cache for 5 minutes
    this.setCache(cacheKey, dbContext, 300000);

    return dbContext;
  }

  /**
   * Generate AI insights using LLM
   */
  async generateInsights(context: AIContext): Promise<InsightData[]> {
    if (!this.checkRateLimit(context.tenantId)) {
      console.warn('Rate limit exceeded for tenant:', context.tenantId);
      return this.generateRuleBasedInsights(context);
    }

    const cacheKey = `insights-${context.tenantId}`;
    const cached = this.getCached<InsightData[]>(cacheKey);
    if (cached) return cached;

    try {
      const dbContext = await this.buildDatabaseContext(context);
      
      const zai = await ZAI.create();
      
      const prompt = `You are an AI analytics assistant for StaySuite, a hotel management system. Analyze the following hotel data and generate actionable insights.

Hotel Data:
- Total Rooms: ${dbContext.occupancy.total}
- Currently Occupied: ${dbContext.occupancy.current} (${dbContext.occupancy.rate.toFixed(1)}% occupancy)
- Today's Revenue: $${dbContext.revenue.today.toFixed(2)}
- Monthly Revenue: $${dbContext.revenue.month.toFixed(2)} (Trend: ${dbContext.revenue.trend > 0 ? '+' : ''}${dbContext.revenue.trend.toFixed(1)}%)

Recent Bookings Summary:
${JSON.stringify(dbContext.bookings.slice(0, 10), null, 2)}

Room Status Distribution:
${JSON.stringify(dbContext.rooms.reduce((acc: Record<string, number>, r) => {
  acc[r.status as string] = (acc[r.status as string] || 0) + 1;
  return acc;
}, {}), null, 2)}

Guest Statistics:
- Total Guests: ${dbContext.guests.length}
- VIP Guests: ${dbContext.guests.filter(g => g.isVip).length}
- Loyalty Tiers: ${JSON.stringify(dbContext.guests.reduce((acc: Record<string, number>, g) => {
  acc[g.loyaltyTier as string] = (acc[g.loyaltyTier as string] || 0) + 1;
  return acc;
}, {}), null, 2)}

Tasks Overview:
${JSON.stringify(dbContext.tasks.reduce((acc: Record<string, number>, t) => {
  acc[t.status as string] = (acc[t.status as string] || 0) + 1;
  return acc;
}, {}), null, 2)}

Generate 3-5 actionable insights in JSON format. Each insight should have:
{
  "category": "revenue" | "operations" | "guest" | "pricing" | "marketing",
  "type": "opportunity" | "alert" | "recommendation" | "prediction" | "insight",
  "title": "Brief title (max 60 chars)",
  "description": "Detailed description (max 200 chars)",
  "impact": "high" | "medium" | "low",
  "potentialRevenue": number (estimated revenue impact if applicable),
  "confidence": number between 0 and 1,
  "action": "Suggested action"
}

Return ONLY a JSON array of insights, no other text.`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a hotel analytics AI. Always respond with valid JSON arrays only, no markdown formatting.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      });

      const responseText = completion.choices[0]?.message?.content || '[]';
      
      // Parse JSON response
      let insights: InsightData[] = [];
      try {
        // Remove any markdown formatting if present
        const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
        insights = JSON.parse(cleanedResponse);
      } catch {
        console.error('Failed to parse AI response:', responseText);
        return this.generateRuleBasedInsights(context);
      }

      // Validate and sanitize insights
      const validInsights = insights.filter(i => 
        i.category && i.type && i.title && i.description && i.impact
      ).map(i => ({
        ...i,
        confidence: Math.min(1, Math.max(0, i.confidence || 0.8)),
        potentialRevenue: i.potentialRevenue || 0,
      }));

      // Cache for 5 minutes
      this.setCache(cacheKey, validInsights, 300000);

      return validInsights;
    } catch (error) {
      console.error('Error generating AI insights:', error);
      return this.generateRuleBasedInsights(context);
    }
  }

  /**
   * Generate rule-based insights as fallback
   */
  async generateRuleBasedInsights(context: AIContext): Promise<InsightData[]> {
    const dbContext = await this.buildDatabaseContext(context);
    const insights: InsightData[] = [];

    // High occupancy opportunity
    if (dbContext.occupancy.rate > 80) {
      insights.push({
        category: 'revenue',
        type: 'opportunity',
        title: 'High Occupancy - Dynamic Pricing Opportunity',
        description: `Current occupancy is ${dbContext.occupancy.rate.toFixed(1)}%. Consider premium pricing for remaining rooms.`,
        impact: 'high',
        potentialRevenue: Math.floor((dbContext.occupancy.total - dbContext.occupancy.current) * 50),
        confidence: 0.85,
        action: 'Apply premium pricing',
      });
    }

    // Low occupancy alert
    if (dbContext.occupancy.rate < 40) {
      insights.push({
        category: 'pricing',
        type: 'alert',
        title: 'Low Occupancy Alert',
        description: `Occupancy is only ${dbContext.occupancy.rate.toFixed(1)}%. Consider promotional rates or marketing campaigns.`,
        impact: 'high',
        potentialRevenue: 0,
        confidence: 0.9,
        action: 'Create promotional campaign',
      });
    }

    // Revenue trend
    if (dbContext.revenue.trend < -10) {
      insights.push({
        category: 'revenue',
        type: 'alert',
        title: 'Revenue Declining',
        description: `Revenue is down ${Math.abs(dbContext.revenue.trend).toFixed(1)}% compared to last month. Review pricing strategy.`,
        impact: 'high',
        potentialRevenue: 0,
        confidence: 0.8,
        action: 'Review pricing strategy',
      });
    }

    // Pending tasks
    const pendingTasks = dbContext.tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
    if (pendingTasks.length > 5) {
      insights.push({
        category: 'operations',
        type: 'alert',
        title: 'Task Backlog Alert',
        description: `${pendingTasks.length} tasks are pending. Consider prioritizing or delegating to improve operations.`,
        impact: 'medium',
        confidence: 0.85,
        action: 'Review task queue',
      });
    }

    // VIP guest engagement
    const vipGuests = dbContext.guests.filter(g => g.isVip);
    if (vipGuests.length > 0) {
      insights.push({
        category: 'guest',
        type: 'recommendation',
        title: 'VIP Guest Engagement',
        description: `${vipGuests.length} VIP guests identified. Ensure personalized services for upcoming stays.`,
        impact: 'medium',
        confidence: 0.75,
        action: 'Review VIP guest list',
      });
    }

    return insights;
  }

  /**
   * Process chat message with context
   */
  async processChat(
    messages: Array<{ role: string; content: string }>,
    context: AIContext
  ): Promise<string> {
    if (!this.checkRateLimit(context.tenantId)) {
      return 'Rate limit exceeded. Please try again in a moment.';
    }

    try {
      const dbContext = await this.buildDatabaseContext(context);
      
      const zai = await ZAI.create();
      
      const systemPrompt = `You are an AI assistant for StaySuite, a hospitality management system. You help hotel staff with:
- Booking management (search, create, modify reservations)
- Guest services (lookup, preferences, special requests)
- Operations (room status, housekeeping tasks, maintenance)
- Analytics (revenue reports, occupancy trends, performance metrics)
- General hotel operations questions

Current Hotel Context:
- Occupancy: ${dbContext.occupancy.rate.toFixed(1)}% (${dbContext.occupancy.current}/${dbContext.occupancy.total} rooms)
- Today's Revenue: $${dbContext.revenue.today.toFixed(2)}
- Monthly Revenue: $${dbContext.revenue.month.toFixed(2)} (${dbContext.revenue.trend > 0 ? '+' : ''}${dbContext.revenue.trend.toFixed(1)}% vs last month)

Be concise, professional, and helpful. Use markdown formatting for better readability.
When showing data, use tables when appropriate.

If asked to search for bookings, guests, or other data, query based on the context provided and give real information.`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return completion.choices[0]?.message?.content || 'I apologize, I could not process your request.';
    } catch (error) {
      console.error('Error in AI chat:', error);
      throw error;
    }
  }

  /**
   * Search bookings with natural language
   */
  async searchBookings(
    query: string,
    context: AIContext
  ): Promise<Array<Record<string, unknown>>> {
    const dbContext = await this.buildDatabaseContext(context);
    
    // Use LLM to interpret the query
    try {
      const zai = await ZAI.create();
      
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a booking search assistant. Given a search query and booking data, return matching booking IDs as a JSON array.
Only return the booking IDs that match the query criteria. If no matches, return an empty array.`,
          },
          {
            role: 'user',
            content: `Query: "${query}"
            
Bookings:
${JSON.stringify(dbContext.bookings, null, 2)}

Return only a JSON array of matching booking IDs.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content || '[]';
      const ids = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
      
      return dbContext.bookings.filter(b => ids.includes(b.id));
    } catch {
      // Fallback to simple text search
      const lowerQuery = query.toLowerCase();
      return dbContext.bookings.filter(b => 
        (b.guestName as string)?.toLowerCase().includes(lowerQuery) ||
        (b.roomNumber as string)?.toLowerCase().includes(lowerQuery) ||
        (b.status as string)?.toLowerCase().includes(lowerQuery)
      );
    }
  }

  /**
   * Lookup guest information
   */
  async lookupGuest(
    query: string,
    context: AIContext
  ): Promise<Array<Record<string, unknown>>> {
    const dbContext = await this.buildDatabaseContext(context);
    
    try {
      const zai = await ZAI.create();
      
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a guest lookup assistant. Given a search query and guest data, return matching guest IDs as a JSON array.
Only return the guest IDs that match the query criteria. If no matches, return an empty array.`,
          },
          {
            role: 'user',
            content: `Query: "${query}"
            
Guests:
${JSON.stringify(dbContext.guests, null, 2)}

Return only a JSON array of matching guest IDs.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content || '[]';
      const ids = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
      
      return dbContext.guests.filter(g => ids.includes(g.id));
    } catch {
      // Fallback to simple text search
      const lowerQuery = query.toLowerCase();
      return dbContext.guests.filter(g => 
        (g.name as string)?.toLowerCase().includes(lowerQuery) ||
        (g.email as string)?.toLowerCase().includes(lowerQuery)
      );
    }
  }

  /**
   * Query revenue data with natural language
   */
  async queryRevenue(
    query: string,
    context: AIContext
  ): Promise<{ answer: string; data: Record<string, unknown> }> {
    const dbContext = await this.buildDatabaseContext(context);
    
    try {
      const zai = await ZAI.create();
      
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a revenue analytics assistant. Answer questions about hotel revenue based on the provided data.
Be concise and include specific numbers. Format your response in markdown.`,
          },
          {
            role: 'user',
            content: `Query: "${query}"
            
Revenue Data:
- Today's Revenue: $${dbContext.revenue.today.toFixed(2)}
- Weekly Revenue: $${dbContext.revenue.week.toFixed(2)}
- Monthly Revenue: $${dbContext.revenue.month.toFixed(2)}
- Revenue Trend: ${dbContext.revenue.trend > 0 ? '+' : ''}${dbContext.revenue.trend.toFixed(1)}% vs last month
- Occupancy Rate: ${dbContext.occupancy.rate.toFixed(1)}%
- Occupied Rooms: ${dbContext.occupancy.current}/${dbContext.occupancy.total}

Recent Bookings:
${JSON.stringify(dbContext.bookings.slice(0, 20), null, 2)}

Provide a clear answer to the query.`,
          },
        ],
        temperature: 0.5,
        max_tokens: 500,
      });

      return {
        answer: completion.choices[0]?.message?.content || 'Unable to process query.',
        data: {
          todayRevenue: dbContext.revenue.today,
          monthRevenue: dbContext.revenue.month,
          trend: dbContext.revenue.trend,
          occupancy: dbContext.occupancy.rate,
        },
      };
    } catch (error) {
      console.error('Error in revenue query:', error);
      throw error;
    }
  }

  /**
   * Store insight in database
   */
  async storeInsight(
    insight: InsightData,
    context: AIContext
  ): Promise<string> {
    const stored = await db.aISuggestion.create({
      data: {
        tenantId: context.tenantId,
        type: insight.category,
        title: insight.title,
        description: insight.description,
        impact: insight.impact,
        potentialRevenue: insight.potentialRevenue || 0,
        confidence: insight.confidence,
        status: 'pending',
        data: JSON.stringify(insight.data || {}),
      },
    });

    return stored.id;
  }

  /**
   * Get stored insights from database
   */
  async getStoredInsights(
    context: AIContext,
    options?: {
      status?: string;
      type?: string;
      limit?: number;
    }
  ): Promise<Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    impact: string;
    potentialRevenue: number;
    confidence: number;
    status: string;
    data: string;
    appliedAt: Date | null;
    dismissedAt: Date | null;
    createdAt: Date;
  }>> {
    const where: Record<string, unknown> = {
      tenantId: context.tenantId,
    };

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.type) {
      where.type = options.type;
    }

    return db.aISuggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 20,
    });
  }

  /**
   * Mark insight as applied
   */
  async applyInsight(insightId: string): Promise<void> {
    await db.aISuggestion.update({
      where: { id: insightId },
      data: {
        status: 'applied',
        appliedAt: new Date(),
      },
    });
  }

  /**
   * Dismiss insight
   */
  async dismissInsight(insightId: string): Promise<void> {
    await db.aISuggestion.update({
      where: { id: insightId },
      data: {
        status: 'dismissed',
        dismissedAt: new Date(),
      },
    });
  }

  /**
   * Generate recommendations for specific context
   */
  async generateRecommendations(
    contextType: 'pricing' | 'marketing' | 'operations' | 'guest_experience',
    context: AIContext
  ): Promise<InsightData[]> {
    const dbContext = await this.buildDatabaseContext(context);
    
    try {
      const zai = await ZAI.create();
      
      const contextPrompts: Record<string, string> = {
        pricing: `Analyze pricing opportunities based on occupancy rate (${dbContext.occupancy.rate.toFixed(1)}%) and revenue trends. Suggest pricing adjustments.`,
        marketing: `Suggest marketing initiatives to increase bookings. Consider current occupancy (${dbContext.occupancy.rate.toFixed(1)}%) and guest segments.`,
        operations: `Identify operational improvements based on task backlog and room status distribution.`,
        guest_experience: `Recommend ways to enhance guest experience based on VIP guests, loyalty tiers, and stay history.`,
      };

      const prompt = `${contextPrompts[contextType]}

Hotel Data:
${JSON.stringify({
  occupancy: dbContext.occupancy,
  revenue: dbContext.revenue,
  guests: dbContext.guests.slice(0, 20),
  tasks: dbContext.tasks,
  rooms: dbContext.rooms.reduce((acc: Record<string, number>, r) => {
    acc[r.status as string] = (acc[r.status as string] || 0) + 1;
    return acc;
  }, {}),
}, null, 2)}

Generate 2-3 specific recommendations in JSON format:
[{
  "category": "${contextType}",
  "type": "recommendation",
  "title": "Brief title",
  "description": "Detailed description",
  "impact": "high" | "medium" | "low",
  "potentialRevenue": number,
  "confidence": number,
  "action": "Specific action to take"
}]`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a hotel recommendation engine. Always respond with valid JSON arrays only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      const response = completion.choices[0]?.message?.content || '[]';
      const recommendations = JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
      
      return recommendations.filter((r: InsightData) => r.title && r.description);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Clear cache for tenant
   */
  clearCache(tenantId: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(tenantId)) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const aiService = new AIService();

// Export convenience functions
export const generateInsights = (context: AIContext) => aiService.generateInsights(context);
export const processChat = (
  messages: Array<{ role: string; content: string }>,
  context: AIContext
) => aiService.processChat(messages, context);
export const searchBookings = (query: string, context: AIContext) =>
  aiService.searchBookings(query, context);
export const lookupGuest = (query: string, context: AIContext) =>
  aiService.lookupGuest(query, context);
export const queryRevenue = (query: string, context: AIContext) =>
  aiService.queryRevenue(query, context);
