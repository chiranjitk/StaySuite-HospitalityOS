/**
 * Recurring Task Scheduler
 *
 * POST /api/cron/recurring-tasks
 * Generates new task instances from completed recurring tasks.
 * Should be called by an external cron scheduler (e.g., Vercel Cron, cron-job.org).
 *
 * Recommended schedule: Every hour or daily at midnight
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateRecurringTasks } from '@/lib/housekeeping-automation';
import { db } from '@/lib/db';
import { emailService } from '@/lib/services/email-service';

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
        data: { created: 0, dryRun: true },
      });
    }

    // Generate recurring tasks
    const result = await generateRecurringTasks();

    // Check-in reminders: Send email to guests checking in tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const checkinTomorrow = await db.booking.findMany({
      where: {
        checkIn: { gte: tomorrow, lt: dayAfter },
        status: { in: ['confirmed', 'pending'] },
      },
      include: {
        primaryGuest: true,
        property: true,
        room: true,
      },
    });

    for (const booking of checkinTomorrow) {
      if (booking.primaryGuest?.email) {
        try {
          await emailService.send({
            to: booking.primaryGuest.email,
            subject: 'Check-in Reminder - Tomorrow!',
            variables: {
              guestName: booking.primaryGuest.firstName || 'Guest',
              propertyName: booking.property?.name || 'Hotel',
              checkInDate: booking.checkIn.toLocaleDateString(),
              address: booking.property?.address || '',
              portalLink: `${process.env.APP_URL || 'http://localhost:3000'}/portal/${booking.portalToken || ''}`,
            },
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0;">Check-in Reminder</h1>
                </div>
                <div style="padding: 20px; border: 1px solid #eee; border-top: none;">
                  <p>Hello {{guestName}},</p>
                  <p>This is a friendly reminder that you are checking in <strong>tomorrow</strong>!</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr><td style="padding: 8px;"><strong>Property</strong></td><td>{{propertyName}}</td></tr>
                    <tr><td style="padding: 8px;"><strong>Date</strong></td><td>{{checkInDate}}</td></tr>
                    ${booking.property?.address ? `<tr><td style="padding: 8px;"><strong>Address</strong></td><td>{{address}}</td></tr>` : ''}
                  </table>
                  <p><a href="{{portalLink}}" style="display: inline-block; padding: 12px 24px; background-color: #1a1a2e; color: white; text-decoration: none; border-radius: 6px;">Manage Your Stay</a></p>
                  <p style="color: #888; font-size: 12px;">StaySuite Hotel Management System</p>
                </div>
              </div>
            `,
            text: `Hello {{guestName}},\n\nReminder: You are checking in tomorrow at {{propertyName}}!\n\nDate: {{checkInDate}}\nAddress: {{address}}\n\nManage your stay: {{portalLink}}\n\nStaySuite Hotel Management System`,
            tags: { type: 'checkin_reminder', bookingId: booking.id },
          });
        } catch (e) {
          console.error(`[Cron] Failed to send checkin reminder for booking ${booking.id}:`, e);
        }
      }
    }

    // Review requests: Send to guests who checked out yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const twoDaysAgo = new Date(yesterday);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);

    const checkedOutYesterday = await db.booking.findMany({
      where: {
        checkOut: { gte: yesterday, lt: new Date() },
        status: 'checked_out',
      },
      include: {
        primaryGuest: true,
        property: true,
      },
    });

    for (const booking of checkedOutYesterday) {
      if (booking.primaryGuest?.email) {
        try {
          const feedbackToken = booking.portalToken || booking.id;
          const feedbackLink = `${process.env.APP_URL || 'http://localhost:3000'}/guest/${feedbackToken}/feedback`;
          await emailService.send({
            to: booking.primaryGuest.email,
            subject: 'How was your stay? We value your feedback!',
            variables: {
              guestName: booking.primaryGuest.firstName || 'Guest',
              propertyName: booking.property?.name || 'Hotel',
              feedbackLink,
            },
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a1a2e;">How was your stay?</h2>
                <p>Hello {{guestName}},</p>
                <p>Thank you for staying at <strong>{{propertyName}}</strong>! We hope you had a wonderful experience.</p>
                <p>We would love to hear your feedback. It helps us improve and serve you better next time.</p>
                <p><a href="{{feedbackLink}}" style="display: inline-block; padding: 12px 24px; background-color: #1a1a2e; color: white; text-decoration: none; border-radius: 6px;">Leave a Review</a></p>
                <p style="color: #888; font-size: 12px;">StaySuite Hotel Management System</p>
              </div>
            `,
            text: `Hello {{guestName}},\n\nThank you for staying at {{propertyName}}!\n\nWe would love to hear your feedback. Please take a moment to leave a review:\n\n{{feedbackLink}}\n\nStaySuite Hotel Management System`,
            tags: { type: 'review_request', bookingId: booking.id },
          });
        } catch (e) {
          console.error(`[Cron] Failed to send review request for booking ${booking.id}:`, e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${result.created} recurring tasks. Sent ${checkinTomorrow.length} check-in reminders, ${checkedOutYesterday.length} review requests.`,
      data: {
        recurringTasks: result,
        checkinRemindersSent: checkinTomorrow.length,
        reviewRequestsSent: checkedOutYesterday.length,
      },
    });
  } catch (error) {
    console.error('[Cron] Recurring tasks error:', error);
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
    message: 'Recurring task scheduler endpoint. Use POST to trigger.',
    data: {
      endpoint: '/api/cron/recurring-tasks',
      method: 'POST',
      headers: { Authorization: 'Bearer <CRON_SECRET>' },
      body: { dryRun: 'boolean (optional)' },
    },
  });
}
