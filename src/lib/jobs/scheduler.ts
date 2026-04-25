import cron, { type ScheduledTask } from 'node-cron';
import { db } from '@/lib/db';
import { executeReport, sendReportEmail } from './report-executor';

// Track active cron jobs
const activeJobs = new Map<string, ScheduledTask>();

/**
 * Initialize the scheduler - start cron jobs for scheduled reports
 */
export function initializeScheduler(): void {
  // Run every minute to check for pending reports
  const mainJob = cron.schedule('* * * * *', async () => {
    await processScheduledReports();
  });

  activeJobs.set('main', mainJob);
  console.log('[Scheduler] Initialized - checking for scheduled reports every minute');
}

/**
 * Stop all active cron jobs
 */
export function stopScheduler(): void {
  for (const [name, job] of activeJobs) {
    job.stop();
    console.log(`[Scheduler] Stopped job: ${name}`);
  }
  activeJobs.clear();
}

/**
 * Process all scheduled reports that are due
 */
export async function processScheduledReports(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ reportId: string; error: string }>;
}> {
  const now = new Date();
  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as Array<{ reportId: string; error: string }>,
  };

  try {
    // Find all active scheduled reports that are due
    const dueReports = await db.scheduledReport.findMany({
      where: {
        isActive: true,
        nextRunAt: {
          lte: now,
        },
      },
    });

    console.log(`[Scheduler] Found ${dueReports.length} reports due for execution`);

    for (const report of dueReports) {
      results.processed++;

      try {
        // Execute the report
        const executionResult = await executeReport(report);

        // Create history record
        const historyRecord = await db.reportHistory.create({
          data: {
            tenantId: report.tenantId,
            scheduledReportId: report.id,
            name: report.name,
            type: report.type,
            format: report.format,
            generatedAt: new Date(),
            periodStart: executionResult.periodStart,
            periodEnd: executionResult.periodEnd,
            fileUrl: executionResult.fileUrl,
            fileSize: executionResult.fileSize,
            status: 'completed',
            recipientCount: JSON.parse(report.recipients || '[]').length,
            sentAt: executionResult.sentAt,
          },
        });

        // Send email if delivery method is email
        if (report.deliveryMethod === 'email') {
          const recipients = JSON.parse(report.recipients || '[]');
          if (recipients.length > 0) {
            await sendReportEmail({
              to: recipients,
              reportName: report.name,
              reportType: report.type,
              fileUrl: executionResult.fileUrl,
              fileContent: executionResult.fileContent,
              format: report.format,
            });
          }
        }

        // Calculate next run time
        const nextRunAt = calculateNextRun(report);

        // Update the scheduled report
        await db.scheduledReport.update({
          where: { id: report.id },
          data: {
            lastRunAt: now,
            nextRunAt,
          },
        });

        results.succeeded++;
        console.log(`[Scheduler] Successfully executed report: ${report.name} (${report.id})`);
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({ reportId: report.id, error: errorMessage });

        // Create failed history record
        await db.reportHistory.create({
          data: {
            tenantId: report.tenantId,
            scheduledReportId: report.id,
            name: report.name,
            type: report.type,
            format: report.format,
            generatedAt: new Date(),
            status: 'failed',
            errorMessage,
            recipientCount: 0,
          },
        });

        console.error(`[Scheduler] Failed to execute report ${report.name}:`, errorMessage);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error processing scheduled reports:', error);
  }

  return results;
}

/**
 * Calculate the next run time based on frequency
 */
function calculateNextRun(report: {
  frequency: string;
  time: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
}): Date {
  const now = new Date();
  const [hours, minutes] = report.time.split(':').map(Number);

  let nextRun = new Date();
  nextRun.setHours(hours, minutes, 0, 0);

  switch (report.frequency) {
    case 'daily':
      // If the time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'weekly':
      // Schedule for the next occurrence of the specified day
      const targetDay = report.dayOfWeek ?? 1; // Default to Monday
      const currentDay = now.getDay();
      let daysUntilNext = targetDay - currentDay;
      if (daysUntilNext <= 0 || (daysUntilNext === 0 && nextRun <= now)) {
        daysUntilNext += 7;
      }
      nextRun.setDate(nextRun.getDate() + daysUntilNext);
      break;

    case 'monthly':
      // Schedule for the specified day of next month
      const targetDate = report.dayOfMonth ?? 1;
      nextRun.setDate(targetDate);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;

    case 'quarterly':
      // Schedule for the first day of the next quarter
      const currentMonth = now.getMonth();
      const nextQuarterMonth = Math.floor(currentMonth / 3) * 3 + 3;
      nextRun.setMonth(nextQuarterMonth, 1);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 3);
      }
      break;

    case 'yearly':
      // Schedule for January 1st of next year
      nextRun.setFullYear(now.getFullYear() + 1, 0, 1);
      break;

    default:
      // Default to daily
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
  }

  return nextRun;
}

/**
 * Manually trigger a specific scheduled report
 */
export async function triggerReport(reportId: string): Promise<{
  success: boolean;
  historyId?: string;
  error?: string;
}> {
  try {
    const report = await db.scheduledReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return { success: false, error: 'Report not found' };
    }

    // Execute the report
    const executionResult = await executeReport(report);

    // Create history record
    const historyRecord = await db.reportHistory.create({
      data: {
        tenantId: report.tenantId,
        scheduledReportId: report.id,
        name: report.name,
        type: report.type,
        format: report.format,
        generatedAt: new Date(),
        periodStart: executionResult.periodStart,
        periodEnd: executionResult.periodEnd,
        fileUrl: executionResult.fileUrl,
        fileSize: executionResult.fileSize,
        status: 'completed',
        recipientCount: JSON.parse(report.recipients || '[]').length,
        sentAt: executionResult.sentAt,
      },
    });

    // Send email if delivery method is email
    if (report.deliveryMethod === 'email') {
      const recipients = JSON.parse(report.recipients || '[]');
      if (recipients.length > 0) {
        await sendReportEmail({
          to: recipients,
          reportName: report.name,
          reportType: report.type,
          fileUrl: executionResult.fileUrl,
          fileContent: executionResult.fileContent,
          format: report.format,
        });
      }
    }

    // Update last run time
    await db.scheduledReport.update({
      where: { id: reportId },
      data: { lastRunAt: new Date() },
    });

    return { success: true, historyId: historyRecord.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// Export for use in API routes
export { activeJobs };
