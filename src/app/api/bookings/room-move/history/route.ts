import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/bookings/room-move/history - Get room move history for a booking
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const bookingId = searchParams.get('bookingId');
    const guestId = searchParams.get('guestId');

    if (!bookingId && !guestId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId or guestId is required' } },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {};
    if (bookingId) where.bookingId = bookingId;
    if (guestId) where.guestId = guestId;

    const history = await db.roomMoveLog.findMany({
      where,
      include: {
        property: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Format the history
    const formattedHistory = history.map(log => ({
      ...log,
      reasonDisplay: log.reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      rateChangeDisplay: log.rateDifference >= 0
        ? `+${log.rateDifference.toFixed(2)}`
        : log.rateDifference.toFixed(2),
      isUpgrade: log.rateDifference > 0,
      isDowngrade: log.rateDifference < 0,
    }));

    return NextResponse.json({
      success: true,
      data: formattedHistory,
      total: formattedHistory.length,
    });
  } catch (error) {
    console.error('Error fetching room move history:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch room move history' } },
      { status: 500 }
    );
  }
}
