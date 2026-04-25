/**
 * Cron Expiration Endpoint
 * 
 * Endpoint to trigger WiFi user expiration check.
 * Should be called by an external cron scheduler (e.g., Vercel Cron, cron-job.org).
 * 
 * Recommended schedule: Every 5-15 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  runExpirationJob, 
  getExpirationStats, 
  getUsersExpiringSoon 
} from '@/lib/jobs/expiration-job';
import { notificationService } from '@/lib/services/notification-service';

// Cron secret for security
const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[CRON] CRON_SECRET environment variable is required in production');
}
const CRON_SECRET_VALUE = CRON_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-cron-secret' : '');

// POST /api/cron/expiration - Run expiration job
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
    const { 
      dryRun = false, 
      tenantId, 
      batchSize = 100,
      notifyExpiring = true,
      expiringThresholdHours = 24,
    } = body;

    // Run the expiration job
    const result = await runExpirationJob({
      dryRun,
      tenantId,
      batchSize,
    });

    // Send notifications for users expiring soon
    if (notifyExpiring && !tenantId) {
      // Only send global notifications if not processing a specific tenant
      await sendExpirationNotifications(expiringThresholdHours);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        dryRun,
      },
    });
  } catch (error) {
    console.error('Error running expiration job:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to run expiration job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET /api/cron/expiration - Get expiration statistics
export async function GET(request: NextRequest) {
  try {
    if (!CRON_SECRET_VALUE) {
      return NextResponse.json({ error: 'Cron secret not configured' }, { status: 403 });
    }
    // Verify cron secret for GET as well (stats contain sensitive data)
    const authHeader = request.headers.get('authorization');
    const searchParams = request.nextUrl.searchParams;
    const providedSecret = authHeader?.replace('Bearer ', '') || searchParams.get('secret');
    
    if (providedSecret !== CRON_SECRET_VALUE) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = searchParams.get('tenantId') || undefined;
    const expiringThreshold = parseInt(searchParams.get('expiringHours') || '24');

    // Get stats
    const stats = await getExpirationStats(tenantId);

    // Get users expiring soon (for a specific tenant)
    let expiringSoon: Array<{
      id: string;
      username: string;
      validUntil: Date;
      guestId: string | null;
      guest: {
        firstName: string;
        lastName: string;
        email: string | null;
        phone: string | null;
      } | null;
    }> = [];

    if (tenantId) {
      expiringSoon = await getUsersExpiringSoon(tenantId, expiringThreshold);
    }

    return NextResponse.json({
      success: true,
      data: {
        stats,
        expiringSoon: expiringSoon.map(u => ({
          id: u.id,
          username: u.username,
          validUntil: u.validUntil,
          guestName: u.guest ? `${u.guest.firstName} ${u.guest.lastName}` : null,
          guestEmail: u.guest?.email,
          guestPhone: u.guest?.phone,
        })),
      },
    });
  } catch (error) {
    console.error('Error getting expiration stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get expiration stats' },
      { status: 500 }
    );
  }
}

/**
 * Send notifications to users expiring soon
 */
async function sendExpirationNotifications(
  hoursThreshold: number
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;

  try {
    // Get all tenants with active WiFi users expiring soon
    const tenants = await db.tenant.findMany({
      where: {
        wifiUsers: {
          some: {
            status: 'active',
            validUntil: {
              gt: new Date(),
              lte: new Date(Date.now() + hoursThreshold * 60 * 60 * 1000),
            },
          },
        },
      },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        const expiringUsers = await getUsersExpiringSoon(tenant.id, hoursThreshold);

        for (const user of expiringUsers) {
          if (!user.guest?.email && !user.guest?.phone) {
            continue;
          }

          try {
            const timeRemaining = Math.round(
              (user.validUntil.getTime() - Date.now()) / (60 * 60 * 1000)
            );

            await notificationService.send({
              tenantId: tenant.id,
              guestId: user.guestId || undefined,
              type: 'wifi',
              category: 'warning',
              title: 'WiFi Access Expiring Soon',
              message: `Your WiFi access will expire in approximately ${timeRemaining} hours. Please contact reception to extend your access.`,
              channels: ['email', 'sms'],
              data: {
                wifiUsername: user.username,
                validUntil: user.validUntil.toISOString(),
                hoursRemaining: timeRemaining,
              },
            });

            sent++;
          } catch (error) {
            errors.push(
              `Failed to send notification to user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      } catch (error) {
        errors.push(
          `Failed to process tenant ${tenant.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  } catch (error) {
    errors.push(`Failed to get tenants: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { sent, errors };
}
