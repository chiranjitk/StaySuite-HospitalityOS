/**
 * No-Show Detection Cron Job
 *
 * POST /api/cron/no-show-detection
 * Scans all tenants and properties for confirmed bookings past their check-in deadline.
 * Automatically marks no-shows, applies penalties, and releases rooms.
 *
 * Should be called by an external cron scheduler (e.g., Vercel Cron, cron-job.org).
 *
 * Recommended schedule: Every hour (e.g., 0 * * * *)
 *
 * GET /api/cron/no-show-detection
 * Returns the last execution status and next scheduled run info.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  detectAndProcessNoShows,
  getLastExecutionStatus,
  getNextScheduledRun,
} from '@/lib/no-show-engine';

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[CRON] CRON_SECRET environment variable is required in production');
}
const CRON_SECRET_VALUE = CRON_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-cron-secret' : '');

export async function POST(request: NextRequest) {
  try {
    if (!CRON_SECRET_VALUE) {
      return NextResponse.json({ error: 'Cron secret not configured' }, { status: 403 });
    }
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');

    if (providedSecret !== CRON_SECRET_VALUE) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { dryRun = false, tenantId } = body;

    if (dryRun) {
      // Dry run: return what would be processed without actually processing
      return NextResponse.json({
        success: true,
        message: 'Dry run - no no-shows were processed',
        data: {
          dryRun: true,
          processed: 0,
          markedNoShow: 0,
          penaltiesApplied: 0,
          roomsReleased: 0,
        },
      });
    }

    const result = await detectAndProcessNoShows(tenantId || undefined);

    return NextResponse.json({
      success: true,
      message: `Processed ${result.total} bookings: ${result.markedNoShow.length} marked as no-show, ${result.penaltiesApplied} penalties applied, ${result.roomsReleased} rooms released`,
      data: {
        processed: result.total,
        markedNoShow: result.markedNoShow.length,
        penaltiesApplied: result.penaltiesApplied,
        roomsReleased: result.roomsReleased,
        details: {
          noShows: result.markedNoShow.map((ns) => ({
            bookingId: ns.bookingId,
            confirmationCode: ns.confirmationCode,
            guestName: ns.guestName,
            roomNumber: ns.roomNumber,
            penaltyAmount: ns.penaltyAmount,
          })),
          skipped: result.skipped,
        },
      },
    });
  } catch (error) {
    console.error('[Cron] No-show detection error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (!CRON_SECRET_VALUE) {
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 403 });
  }
  const lastStatus = getLastExecutionStatus();
  const nextRun = getNextScheduledRun();

  return NextResponse.json({
    success: true,
    message: 'No-show detection endpoint. Use POST to trigger.',
    data: {
      endpoint: '/api/cron/no-show-detection',
      method: 'POST',
      headers: { Authorization: 'Bearer <CRON_SECRET>' },
      body: {
        dryRun: 'boolean (optional)',
        tenantId: 'string (optional — process single tenant)',
      },
      lastExecution: lastStatus
        ? {
            timestamp: lastStatus.timestamp,
            processed: lastStatus.total,
            markedNoShow: lastStatus.markedNoShow.length,
            penaltiesApplied: lastStatus.penaltiesApplied,
            roomsReleased: lastStatus.roomsReleased,
          }
        : null,
      nextScheduledRun: nextRun,
    },
  });
}
