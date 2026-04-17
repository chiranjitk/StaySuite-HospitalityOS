import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/guests/[id]/journey - Get guest journey timeline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build where clause with tenantId isolation
    const whereClause: Record<string, unknown> = { guestId: id, tenantId: auth.tenantId };
    if (stage) {
      whereClause.stage = stage;
    }

    // Get journey events
    const journeyEvents = await db.guestJourney.findMany({
      where: whereClause,
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });

    // Get guest info — scoped to tenant
    const guest = await db.guest.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        tenantId: true,
      },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    // Group events by stage
    const stages = {
      discovery: journeyEvents.filter(e => e.stage === 'discovery'),
      booking: journeyEvents.filter(e => e.stage === 'booking'),
      pre_arrival: journeyEvents.filter(e => e.stage === 'pre_arrival'),
      stay: journeyEvents.filter(e => e.stage === 'stay'),
      post_stay: journeyEvents.filter(e => e.stage === 'post_stay'),
    };

    // Calculate stage progress
    const stageProgress = {
      discovery: stages.discovery.length > 0,
      booking: stages.booking.length > 0,
      pre_arrival: stages.pre_arrival.length > 0,
      stay: stages.stay.length > 0,
      post_stay: stages.post_stay.length > 0,
    };

    // Determine current stage
    const currentStage = Object.entries(stageProgress)
      .filter(([, hasEvents]) => hasEvents)
      .pop()?.[0] || 'discovery';

    return NextResponse.json({
      success: true,
      data: {
        guest,
        events: journeyEvents,
        stages,
        stageProgress,
        currentStage,
        totalEvents: journeyEvents.length,
      },
    });
  } catch (error) {
    console.error('Error fetching guest journey:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch guest journey' } },
      { status: 500 }
    );
  }
}

// POST /api/guests/[id]/journey - Add journey event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    // Validate required fields
    const { stage, eventType, title, description, metadata, source, bookingId } = body;

    if (!stage || !eventType || !title) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'stage, eventType, and title are required' } },
        { status: 400 }
      );
    }

    // Get guest to get tenantId — scoped to current tenant
    const guest = await db.guest.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { tenantId: true },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    // Create journey event
    const journeyEvent = await db.guestJourney.create({
      data: {
        tenantId: guest.tenantId,
        guestId: id,
        bookingId,
        stage,
        eventType,
        title,
        description,
        metadata: metadata ? JSON.stringify(metadata) : '{}',
        source: source || 'system',
      },
    });

    return NextResponse.json({
      success: true,
      data: journeyEvent,
    });
  } catch (error) {
    console.error('Error creating journey event:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create journey event' } },
      { status: 500 }
    );
  }
}
