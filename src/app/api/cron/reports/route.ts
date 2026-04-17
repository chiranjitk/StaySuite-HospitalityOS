import { NextRequest, NextResponse } from 'next/server';
import { processScheduledReports, triggerReport } from '@/lib/jobs/scheduler';

// Cron secret for security - should be set in environment variables
const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[CRON] CRON_SECRET environment variable is required in production');
}
const CRON_SECRET_VALUE = CRON_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-cron-secret' : '');

/**
 * GET /api/cron/reports - Health check
 * Requires authentication since it confirms the endpoint is active
 */
export async function GET(request: NextRequest) {
  if (!CRON_SECRET_VALUE) {
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 403 });
  }
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const searchParams = request.nextUrl.searchParams;
  const providedSecret = authHeader?.replace('Bearer ', '') || searchParams.get('secret');

  if (providedSecret !== CRON_SECRET_VALUE) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Report scheduler endpoint is active',
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/cron/reports - Execute scheduled reports
 *
 * This endpoint should be called by an external cron service (like Vercel Cron)
 * or by the internal scheduler to process pending scheduled reports.
 *
 * Security: Requires a valid cron secret in the Authorization header
 * or as a query parameter for backward compatibility.
 */
export async function POST(request: NextRequest) {
  try {
    if (!CRON_SECRET_VALUE) {
      return NextResponse.json({ error: 'Cron secret not configured' }, { status: 403 });
    }
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const searchParams = request.nextUrl.searchParams;
    const providedSecret = authHeader?.replace('Bearer ', '') || searchParams.get('secret');

    if (providedSecret !== CRON_SECRET_VALUE) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } },
        { status: 401 }
      );
    }

    // Check if a specific report ID is provided
    const reportId = searchParams.get('reportId');

    if (reportId) {
      // Trigger a specific report
      const result = await triggerReport(reportId);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Report executed successfully',
          historyId: result.historyId,
        });
      } else {
        return NextResponse.json(
          { success: false, error: { code: 'EXECUTION_FAILED', message: result.error } },
          { status: 500 }
        );
      }
    }

    // Process all due scheduled reports
    const results = await processScheduledReports();

    return NextResponse.json({
      success: true,
      message: 'Scheduled reports processed',
      timestamp: new Date().toISOString(),
      results: {
        processed: results.processed,
        succeeded: results.succeeded,
        failed: results.failed,
        errors: results.errors,
      },
    });
  } catch (error) {
    console.error('[Cron] Error processing scheduled reports:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process scheduled reports' } },
      { status: 500 }
    );
  }
}
