/**
 * Preventive Maintenance Auto-Trigger
 *
 * POST /api/cron/pm-autotrigger
 * Checks for overdue preventive maintenance items and creates tasks automatically.
 * Should be called by an external cron scheduler.
 *
 * Recommended schedule: Every 6 hours or daily at 6 AM
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkOverduePreventiveMaintenance } from '@/lib/housekeeping-automation';

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
    const { dryRun = false } = body;

    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: 'Dry run - no tasks were created',
        data: { overdue: 0, created: 0, dryRun: true },
      });
    }

    const result = await checkOverduePreventiveMaintenance();

    return NextResponse.json({
      success: true,
      message: `Found ${result.overdue} overdue PM items, created ${result.created} tasks`,
      data: result,
    });
  } catch (error) {
    console.error('[Cron] PM auto-trigger error:', error);
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
  return NextResponse.json({
    success: true,
    message: 'PM auto-trigger endpoint. Use POST to trigger.',
    data: {
      endpoint: '/api/cron/pm-autotrigger',
      method: 'POST',
      headers: { Authorization: 'Bearer <CRON_SECRET>' },
      body: { dryRun: 'boolean (optional)' },
    },
  });
}
