import { NextRequest, NextResponse } from 'next/server';
import { aiService, AIContext } from '@/lib/services/ai-service';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface CopilotRequest {
  messages: ChatMessage[];
  stream?: boolean;
  context?: {
    propertyId?: string;
  userId?: string;
    userRole?: string;
  };
  action?: 'chat' | 'search_bookings' | 'lookup_guest' | 'query_revenue';
  query?: string;
}

/**
 * POST - AI Copilot chat and actions
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check - copilot is available to all authenticated users
    if (!hasPermission(user, 'ai.copilot') && !hasPermission(user, 'ai.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body: CopilotRequest = await request.json();
    const { messages, context, action, query } = body;

    const tenantId = user.tenantId;
    const aiContext: AIContext = {
      tenantId,
      propertyId: context?.propertyId,
      userId: user.id,
      userRole: user.roleName,
    };

    // Check if client wants SSE streaming
    const wantStream = request.headers.get('accept') === 'text/event-stream' || body.stream === true;
    if (wantStream && messages && messages.length > 0) {
      return handleStreamingChat(messages, aiContext);
    }

    // Handle different action types
    if (action === 'search_bookings' && query) {
      return handleBookingSearch(query, aiContext);
    }

    if (action === 'lookup_guest' && query) {
      return handleGuestLookup(query, aiContext);
    }

    if (action === 'query_revenue' && query) {
      return handleRevenueQuery(query, aiContext);
    }

    // Default: regular chat
    return handleChat(messages, aiContext);
  } catch (error) {
    console.error('Error in AI copilot:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process AI request' },
      { status: 500 }
    );
  }
}

/**
 * Handle regular chat messages
 */
async function handleChat(
  messages: ChatMessage[],
  context: AIContext
): Promise<NextResponse> {
  try {
    // Detect intent from the last message
    const lastMessage = messages[messages.length - 1]?.content || '';
    const intent = detectIntent(lastMessage);

    // If the user is asking for specific data, use specialized handlers
    if (intent === 'booking_search') {
      const results = await aiService.searchBookings(lastMessage, context);
      const formattedResults = formatBookingResults(results);
      return NextResponse.json({
        success: true,
        data: {
          message: formattedResults,
          timestamp: new Date().toISOString(),
          action: 'booking_search',
          results: results.slice(0, 10),
        },
      });
    }

    if (intent === 'guest_lookup') {
      const results = await aiService.lookupGuest(lastMessage, context);
      const formattedResults = formatGuestResults(results);
      return NextResponse.json({
        success: true,
        data: {
          message: formattedResults,
          timestamp: new Date().toISOString(),
          action: 'guest_lookup',
          results: results.slice(0, 10),
        },
      });
    }

    if (intent === 'revenue_query') {
      const result = await aiService.queryRevenue(lastMessage, context);
      return NextResponse.json({
        success: true,
        data: {
          message: result.answer,
          timestamp: new Date().toISOString(),
          action: 'revenue_query',
          data: result.data,
        },
      });
    }

    // Otherwise, use the general AI chat
    const response = await aiService.processChat(messages, context);

    return NextResponse.json({
      success: true,
      data: {
        message: response,
        timestamp: new Date().toISOString(),
        action: 'chat',
      },
    });
  } catch (error) {
    console.error('Error in chat:', error);
    // Fallback to simulated response
    return fallbackChat(messages);
  }
}

/**
 * Handle streaming chat using Server-Sent Events
 */
async function handleStreamingChat(
  messages: ChatMessage[],
  context: AIContext
): Promise<NextResponse> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Emit a start event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', timestamp: new Date().toISOString() })}\n\n`));

        // Process with AI service - if it fails, use fallback chunks
        try {
          const response = await aiService.processChat(messages, context);
          // Simulate streaming by splitting into chunks
          const words = String(response).split(' ');
          for (const word of words) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: word + ' ' })}\n\n`));
            // Small delay for streaming effect
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        } catch {
          // Fallback streaming
          const fallback = fallbackResponse(messages);
          const words = fallback.split(' ');
          for (const word of words) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: word + ' ' })}\n\n`));
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        }

        // Emit done event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', timestamp: new Date().toISOString() })}\n\n`));
        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Streaming failed' })}\n\n`));
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Generate a fallback response based on user intent
 */
function fallbackResponse(messages: ChatMessage[]): string {
  const lastMessage = messages[messages.length - 1]?.content || '';
  const intent = detectIntent(lastMessage);

  if (intent === 'booking_search') {
    return `I'll help you search for bookings. Based on your request about "${lastMessage}", please try using the Bookings module for the most comprehensive search results. You can filter by date, guest name, or booking status.`;
  }

  if (intent === 'guest_lookup') {
    return `I can help you look up guest information. For "${lastMessage}", the Guest Directory in the People module provides detailed profiles including stay history, preferences, and loyalty status.`;
  }

  if (intent === 'revenue_query') {
    return `For revenue information related to "${lastMessage}", the Reports module offers detailed financial analytics including daily revenue, ADR, RevPAR, and trend comparisons. Check the Revenue Dashboard for a quick overview.`;
  }

  return `I understand you're asking about "${lastMessage}". I'm currently unable to connect to the AI service, but here are some suggestions:\n\n- Use the **Bookings** module for reservation management\n- Check the **Reports** dashboard for analytics\n- Visit **Guest Directory** for guest information\n- The **Front Desk** module handles check-in/check-out operations\n\nPlease try again in a moment.`;
}

/**
 * Handle booking search action
 */
async function handleBookingSearch(
  query: string,
  context: AIContext
): Promise<NextResponse> {
  try {
    const results = await aiService.searchBookings(query, context);
    const formattedResults = formatBookingResults(results);

    return NextResponse.json({
      success: true,
      data: {
        message: formattedResults,
        timestamp: new Date().toISOString(),
        action: 'booking_search',
        query,
        results: results.slice(0, 10),
        total: results.length,
      },
    });
  } catch (error) {
    console.error('Error searching bookings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search bookings' },
      { status: 500 }
    );
  }
}

/**
 * Handle guest lookup action
 */
async function handleGuestLookup(
  query: string,
  context: AIContext
): Promise<NextResponse> {
  try {
    const results = await aiService.lookupGuest(query, context);
    const formattedResults = formatGuestResults(results);

    return NextResponse.json({
      success: true,
      data: {
        message: formattedResults,
        timestamp: new Date().toISOString(),
        action: 'guest_lookup',
        query,
        results: results.slice(0, 10),
        total: results.length,
      },
    });
  } catch (error) {
    console.error('Error looking up guest:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to lookup guest' },
      { status: 500 }
    );
  }
}

/**
 * Handle revenue query action
 */
async function handleRevenueQuery(
  query: string,
  context: AIContext
): Promise<NextResponse> {
  try {
    const result = await aiService.queryRevenue(query, context);

    return NextResponse.json({
      success: true,
      data: {
        message: result.answer,
        timestamp: new Date().toISOString(),
        action: 'revenue_query',
        query,
        data: result.data,
      },
    });
  } catch (error) {
    console.error('Error querying revenue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to query revenue' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get copilot context/suggestions
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'ai.copilot') && !hasPermission(user, 'ai.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId') || undefined;

    const context: AIContext = {
      tenantId,
      propertyId,
    };

    // Build database context for quick stats
    const dbContext = await aiService.buildDatabaseContext(context);

    // Get today's check-ins and check-outs
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todaysCheckIns, todaysCheckOuts] = await Promise.all([
      db.booking.count({
        where: {
          tenantId,
          checkIn: { gte: today, lt: tomorrow },
          status: 'confirmed',
        },
      }),
      db.booking.count({
        where: {
          tenantId,
          checkOut: { gte: today, lt: tomorrow },
          status: 'checked_in',
        },
      }),
    ]);

    // Get pending tasks
    const pendingTasks = await db.task.count({
      where: {
        tenantId,
        status: { in: ['pending', 'in_progress'] },
      },
    });

    // Get urgent alerts
    const alerts: Array<{ type: string; message: string }> = [];

    if (dbContext.occupancy.rate > 90) {
      alerts.push({
        type: 'info',
        message: `High occupancy: ${dbContext.occupancy.rate.toFixed(0)}% - Consider premium pricing`,
      });
    }

    if (dbContext.occupancy.rate < 30) {
      alerts.push({
        type: 'warning',
        message: `Low occupancy: ${dbContext.occupancy.rate.toFixed(0)}% - Consider promotional offers`,
      });
    }

    if (pendingTasks > 10) {
      alerts.push({
        type: 'warning',
        message: `${pendingTasks} pending tasks require attention`,
      });
    }

    // Generate quick suggestions based on context
    const suggestions = [
      {
        type: 'booking',
        text: "Show today's check-ins",
        action: 'search_bookings',
      },
      {
        type: 'revenue',
        text: 'What is the revenue trend?',
        action: 'query_revenue',
      },
      {
        type: 'guest',
        text: 'Show VIP guests arriving today',
        action: 'guest_lookup',
      },
      {
        type: 'operations',
        text: 'What tasks are pending?',
        action: 'chat',
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        context: {
          occupancy: dbContext.occupancy,
          revenue: {
            today: dbContext.revenue.today,
            month: dbContext.revenue.month,
            trend: dbContext.revenue.trend,
          },
          todaysCheckIns,
          todaysCheckOuts,
          pendingTasks,
          alerts,
        },
        suggestions,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting copilot context:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get copilot context' },
      { status: 500 }
    );
  }
}

/**
 * Detect intent from user message
 */
function detectIntent(message: string): string {
  const lowerMessage = message.toLowerCase();

  // Booking search patterns
  if (
    lowerMessage.includes('booking') ||
    lowerMessage.includes('reservation') ||
    lowerMessage.includes('check-in') ||
    lowerMessage.includes('check-out') ||
    lowerMessage.includes('arrival') ||
    lowerMessage.includes('departure') ||
    lowerMessage.includes('room') ||
    lowerMessage.includes('staying')
  ) {
    return 'booking_search';
  }

  // Guest lookup patterns
  if (
    lowerMessage.includes('guest') ||
    lowerMessage.includes('customer') ||
    lowerMessage.includes('visitor') ||
    lowerMessage.includes('vip') ||
    lowerMessage.includes('loyalty') ||
    /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(message) || // Name pattern
    lowerMessage.includes('email') ||
    lowerMessage.includes('phone')
  ) {
    return 'guest_lookup';
  }

  // Revenue query patterns
  if (
    lowerMessage.includes('revenue') ||
    lowerMessage.includes('sales') ||
    lowerMessage.includes('income') ||
    lowerMessage.includes('earnings') ||
    lowerMessage.includes('profit') ||
    lowerMessage.includes('money') ||
    lowerMessage.includes('financial') ||
    lowerMessage.includes('adr') ||
    lowerMessage.includes('revpar')
  ) {
    return 'revenue_query';
  }

  return 'chat';
}

/**
 * Format booking results for display
 */
function formatBookingResults(
  results: Array<Record<string, unknown>>
): string {
  if (results.length === 0) {
    return 'No bookings found matching your criteria.';
  }

  const lines = [`**Found ${results.length} booking(s)**\n`];

  results.slice(0, 5).forEach((booking, idx) => {
    lines.push(`**${idx + 1}. ${booking.guestName || 'Unknown Guest'}**`);
    lines.push(`   Room: ${booking.roomNumber || 'Not assigned'} (${booking.roomType || 'N/A'})`);
    lines.push(`   Check-in: ${formatDate(booking.checkIn as string)}`);
    lines.push(`   Check-out: ${formatDate(booking.checkOut as string)}`);
    lines.push(`   Status: ${booking.status}`);
    lines.push('');
  });

  if (results.length > 5) {
    lines.push(`_...and ${results.length - 5} more_`);
  }

  return lines.join('\n');
}

/**
 * Format guest results for display
 */
function formatGuestResults(
  results: Array<Record<string, unknown>>
): string {
  if (results.length === 0) {
    return 'No guests found matching your criteria.';
  }

  const lines = [`**Found ${results.length} guest(s)**\n`];

  results.slice(0, 5).forEach((guest, idx) => {
    const vipBadge = guest.isVip ? ' ⭐ VIP' : '';
    lines.push(`**${idx + 1}. ${guest.name || 'Unknown'}**${vipBadge}`);
    lines.push(`   Email: ${guest.email || 'N/A'}`);
    lines.push(`   Loyalty: ${guest.loyaltyTier || 'Bronze'}`);
    lines.push(`   Total Stays: ${guest.totalStays || 0}`);
    lines.push(`   Total Spent: ${typeof guest.totalSpent === 'number' ? guest.totalSpent.toFixed(2) : '0.00'}`);
    lines.push('');
  });

  if (results.length > 5) {
    lines.push(`_...and ${results.length - 5} more_`);
  }

  return lines.join('\n');
}

/**
 * Format date for display
 */
function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Fallback chat when AI service fails
 */
function fallbackChat(messages: ChatMessage[]): NextResponse {
  const lastMessage = messages[messages.length - 1]?.content || '';
  let response = '';

  if (lastMessage.toLowerCase().includes('occupancy')) {
    response = `**Occupancy Overview**

- **Today**: Loading current data...
- **This Weekend**: Loading current data...
- **Next Week**: Loading current data...

💡 **Recommendation**: Try refreshing the page or check back in a moment.`;
  } else if (lastMessage.toLowerCase().includes('check') && lastMessage.toLowerCase().includes('in')) {
    response = `**Today's Check-ins**

I'm currently unable to load real-time data. Please check the dashboard for the most up-to-date information.

**Tip**: You can also use the Front Desk module to manage check-ins.`;
  } else {
    response = `I understand you're asking about "${lastMessage}".

I'm currently experiencing some connectivity issues. Please try again in a moment, or check the relevant module in the dashboard for the information you need.

**Available modules**:
- 📅 Bookings - for reservation management
- 👥 Guests - for guest information
- 💰 Billing - for payments and invoices
- 📊 Reports - for analytics`;
  }

  return NextResponse.json({
    success: true,
    data: {
      message: response,
      timestamp: new Date().toISOString(),
      action: 'chat',
    },
  });
}
