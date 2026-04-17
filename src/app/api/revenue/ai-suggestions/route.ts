import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, getUserFromRequest } from '@/lib/auth-helpers';
import { subDays, addDays, format, getDay, getMonth } from 'date-fns';

// GET /api/revenue/ai-suggestions - Get AI revenue suggestions
export async function GET(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }


  try {
    if (!hasPermission(user, 'revenue:read')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get recent booking trends (last 30 days)
    const thirtyDaysAgo = subDays(new Date(), 30);
    const recentBookings = await db.booking.findMany({
      where: {
        tenantId,
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        roomType: { select: { name: true, id: true } },
      },
    });

    // Get rooms for occupancy calculation - filter by tenant via property IDs
    const tenantProperties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    const tenantPropertyIds = tenantProperties.map(p => p.id);

    const rooms = await db.room.findMany({
      where: {
        propertyId: { in: tenantPropertyIds },
        deletedAt: null,
      },
      select: { status: true, roomTypeId: true },
    });

    const totalRooms = rooms.length || 1;
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const currentOccupancyRate = occupiedRooms / totalRooms;

    // Get rate plans for pricing analysis
    const ratePlans = await db.ratePlan.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        roomType: { select: { name: true, id: true } },
      },
    });

    // Get pricing rules
    const pricingRules = await db.pricingRule.findMany({
      where: { tenantId, isActive: true },
    });

    // Get existing AI suggestions from database
    const existingSuggestions = await db.aISuggestion.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Generate data-driven suggestions
    const suggestions: Array<{ id: string; type: string; title: string; description: string; impact: string; potentialRevenue: number; confidence: number; status: string; createdAt: string }> = [];

    // 1. Weekend pricing suggestion based on occupancy patterns
    const weekendBookings = recentBookings.filter(b => {
      const checkIn = new Date(b.checkIn);
      const day = getDay(checkIn);
      return day === 5 || day === 6; // Friday or Saturday
    });

    const weekdayBookings = recentBookings.filter(b => {
      const checkIn = new Date(b.checkIn);
      const day = getDay(checkIn);
      return day >= 0 && day <= 4;
    });

    const weekendOccupancy = weekendBookings.length / (totalRooms * 8); // ~8 weekend days in 30 days
    const weekdayOccupancy = weekdayBookings.length / (totalRooms * 22); // ~22 weekdays

    if (weekendOccupancy > 0.7 && weekendOccupancy > weekdayOccupancy * 1.3) {
      const avgRate = ratePlans.length > 0
        ? ratePlans.reduce((sum, rp) => sum + rp.basePrice, 0) / ratePlans.length
        : 0;
      const potentialRevenue = Math.round(avgRate * totalRooms * 0.15 * 8); // 15% increase on 8 weekend days

      suggestions.push({
        id: `ai-weekend-${Date.now()}`,
        type: 'pricing',
        title: 'Increase Weekend Rates',
        description: `Weekend occupancy is ${Math.round(weekendOccupancy * 100)}% vs ${Math.round(weekdayOccupancy * 100)}% on weekdays. Consider increasing weekend rates by 10-15%.`,
        impact: 'high',
        potentialRevenue,
        confidence: Math.min(95, 80 + Math.round(weekendOccupancy * 20)),
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    // 2. Advance booking analysis
    const advanceBookings = recentBookings.filter(b => {
      const leadTime = new Date(b.checkIn).getTime() - new Date(b.createdAt).getTime();
      return leadTime > 14 * 24 * 60 * 60 * 1000; // 14+ days in advance
    });

    const lastMinuteBookings = recentBookings.filter(b => {
      const leadTime = new Date(b.checkIn).getTime() - new Date(b.createdAt).getTime();
      return leadTime < 3 * 24 * 60 * 60 * 1000; // Less than 3 days
    });

    if (advanceBookings.length < recentBookings.length * 0.25 && recentBookings.length > 5) {
      suggestions.push({
        id: `ai-early-bird-${Date.now()}`,
        type: 'marketing',
        title: 'Launch Early Bird Promotion',
        description: `Only ${Math.round(advanceBookings.length / recentBookings.length * 100)}% of bookings are made 14+ days in advance. An early bird discount could stimulate advance demand.`,
        impact: 'medium',
        potentialRevenue: Math.round(totalRooms * 50 * 30), // Estimate
        confidence: 78,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    // 3. Room type optimization
    const roomTypeOccupancy: Record<string, { total: number; occupied: number; name: string; basePrice: number }> = {};
    for (const room of rooms) {
      const rtId = room.roomTypeId || 'unknown';
      if (!roomTypeOccupancy[rtId]) {
        const rt = ratePlans.find(rp => rp.roomTypeId === rtId);
        roomTypeOccupancy[rtId] = {
          total: 0,
          occupied: 0,
          name: rt?.roomType?.name || 'Unknown',
          basePrice: rt?.basePrice || 0,
        };
      }
      roomTypeOccupancy[rtId].total++;
      if (room.status === 'occupied') {
        roomTypeOccupancy[rtId].occupied++;
      }
    }

    for (const [rtId, data] of Object.entries(roomTypeOccupancy)) {
      const rate = data.total > 0 ? data.occupied / data.total : 0;
      if (rate < 0.4 && data.total > 0) {
        suggestions.push({
          id: `ai-room-${rtId}-${Date.now()}`,
          type: 'operations',
          title: 'Optimize Room Inventory',
          description: `${data.name} has low occupancy (${Math.round(rate * 100)}%). Consider offering complimentary upgrades or creating targeted packages.`,
          impact: 'medium',
          potentialRevenue: Math.round(data.basePrice * (1 - rate) * 30), // Potential revenue from improvement
          confidence: 75,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
        break; // Only suggest one room type issue
      }
    }

    // 4. Seasonal pricing opportunity
    const currentMonth = getMonth(new Date());
    const seasonalMonths = [5, 6, 7, 11, 0]; // June-July-August, December-January
    if (seasonalMonths.includes(currentMonth) && currentOccupancyRate > 0.6) {
      const avgRate = ratePlans.length > 0
        ? ratePlans.reduce((sum, rp) => sum + rp.basePrice, 0) / ratePlans.length
        : 0;
      suggestions.push({
        id: `ai-seasonal-${Date.now()}`,
        type: 'revenue',
        title: 'Seasonal Pricing Opportunity',
        description: `High season with ${Math.round(currentOccupancyRate * 100)}% occupancy. Consider implementing seasonal pricing rules for additional revenue.`,
        impact: 'high',
        potentialRevenue: Math.round(avgRate * totalRooms * 0.1 * 30), // 10% increase
        confidence: 88,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    // 5. Dynamic pricing suggestion if no rules exist
    if (pricingRules.length === 0 && ratePlans.length > 0) {
      suggestions.push({
        id: `ai-dynamic-${Date.now()}`,
        type: 'pricing',
        title: 'Enable Dynamic Pricing',
        description: 'No pricing rules are configured. Dynamic pricing can optimize revenue based on demand patterns.',
        impact: 'high',
        potentialRevenue: Math.round(totalRooms * 100 * 30), // Conservative estimate
        confidence: 85,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    // 6. Last-minute booking strategy
    if (lastMinuteBookings.length > recentBookings.length * 0.4) {
      suggestions.push({
        id: `ai-lastminute-${Date.now()}`,
        type: 'revenue',
        title: 'Last-Minute Booking Strategy',
        description: `${Math.round(lastMinuteBookings.length / recentBookings.length * 100)}% of bookings are last-minute. Consider a last-minute rate strategy to capture this demand at higher rates.`,
        impact: 'medium',
        potentialRevenue: Math.round(totalRooms * 30 * 30),
        confidence: 72,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    // 7. Low occupancy alert
    if (currentOccupancyRate < 0.4) {
      suggestions.push({
        id: `ai-lowocc-${Date.now()}`,
        type: 'marketing',
        title: 'Low Occupancy Alert',
        description: `Current occupancy is ${Math.round(currentOccupancyRate * 100)}%. Consider promotional campaigns or OTA visibility boost.`,
        impact: 'high',
        potentialRevenue: Math.round(totalRooms * (0.7 - currentOccupancyRate) * 100 * 30),
        confidence: 90,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    // Add existing suggestions from DB
    const allSuggestions = [
      ...suggestions,
      ...existingSuggestions.map(s => ({
        id: s.id,
        type: s.type,
        title: s.title,
        description: s.description || '',
        impact: s.impact,
        potentialRevenue: s.potentialRevenue || 0,
        confidence: s.confidence || 80,
        status: s.status,
        createdAt: s.createdAt?.toISOString() || new Date().toISOString(),
      })),
    ];

    // Calculate summary
    const pendingSuggestions = allSuggestions.filter(s => s.status === 'pending');
    const totalPotentialRevenue = pendingSuggestions.reduce((sum, s) => sum + s.potentialRevenue, 0);
    const avgConfidence = pendingSuggestions.length > 0
      ? Math.round(pendingSuggestions.reduce((sum, s) => sum + s.confidence, 0) / pendingSuggestions.length)
      : 0;

    return NextResponse.json({
      success: true,
      data: allSuggestions.slice(0, 10),
      summary: {
        total: allSuggestions.length,
        pending: pendingSuggestions.length,
        applied: allSuggestions.filter(s => s.status === 'applied').length,
        totalPotentialRevenue,
        avgConfidence,
        hasData: recentBookings.length > 0,
      },
    });
  } catch (error) {
    console.error('Error fetching AI suggestions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch AI suggestions' } },
      { status: 500 }
    );
  }
}

// PUT /api/revenue/ai-suggestions - Update suggestion status
export async function PUT(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }


  try {
    if (!hasPermission(user, 'revenue:write')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'ID and status are required' } },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['pending', 'applied', 'dismissed', 'expired'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } },
        { status: 400 }
      );
    }

    // Verify suggestion belongs to tenant
    const existingSuggestion = await db.aISuggestion.findFirst({
      where: { id, tenantId },
    });

    if (!existingSuggestion) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Suggestion not found' } },
        { status: 404 }
      );
    }

    const suggestion = await db.aISuggestion.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    console.error('Error updating AI suggestion:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update AI suggestion' } },
      { status: 500 }
    );
  }
}

// POST /api/revenue/ai-suggestions - Create a new AI suggestion (for external integrations)
export async function POST(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }


  try {
    if (!hasPermission(user, 'revenue:write')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      type,
      title,
      description,
      impact,
      potentialRevenue,
      confidence,
      data,
    } = body;

    if (!type || !title || !description) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Type, title, and description are required' } },
        { status: 400 }
      );
    }

    const suggestion = await db.aISuggestion.create({
      data: {
        tenantId,
        type,
        title,
        description,
        impact: impact || 'medium',
        potentialRevenue: potentialRevenue || 0,
        confidence: confidence || 80,
        status: 'pending',
        data: data ? JSON.stringify(data) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      data: suggestion,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating AI suggestion:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create AI suggestion' } },
      { status: 500 }
    );
  }
}
