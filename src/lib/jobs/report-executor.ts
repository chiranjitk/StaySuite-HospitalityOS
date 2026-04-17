import { db } from '@/lib/db';
import { sendEmail } from '@/lib/adapters/email';

// Types
interface ScheduledReportData {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  format: string;
  filters: string;
  deliveryMethod: string;
}

interface ReportExecutionResult {
  success: boolean;
  fileUrl?: string;
  fileContent?: Buffer;
  fileSize?: number;
  periodStart?: Date;
  periodEnd?: Date;
  sentAt?: Date;
  error?: string;
}

interface EmailOptions {
  to: string[];
  reportName: string;
  reportType: string;
  fileUrl?: string;
  fileContent?: Buffer;
  format: string;
}

/**
 * Execute a report based on its type
 */
export async function executeReport(report: ScheduledReportData): Promise<ReportExecutionResult> {
  const filters = JSON.parse(report.filters || '{}');
  const now = new Date();

  // Determine report period
  const { periodStart, periodEnd } = determineReportPeriod(filters);

  try {
    let result: ReportExecutionResult;

    switch (report.type) {
      case 'revenue':
        result = await generateRevenueReport(report.tenantId, periodStart, periodEnd, report.format, filters);
        break;

      case 'occupancy':
        result = await generateOccupancyReport(report.tenantId, periodStart, periodEnd, report.format, filters);
        break;

      case 'bookings':
        result = await generateBookingsReport(report.tenantId, periodStart, periodEnd, report.format, filters);
        break;

      case 'guests':
        result = await generateGuestsReport(report.tenantId, periodStart, periodEnd, report.format, filters);
        break;

      case 'financial':
        result = await generateFinancialReport(report.tenantId, periodStart, periodEnd, report.format, filters);
        break;

      case 'housekeeping':
        result = await generateHousekeepingReport(report.tenantId, periodStart, periodEnd, report.format, filters);
        break;

      default:
        result = await generateGenericReport(report.tenantId, report.type, periodStart, periodEnd, report.format, filters);
    }

    return {
      ...result,
      periodStart,
      periodEnd,
    };
  } catch (error) {
    console.error(`[ReportExecutor] Error executing report ${report.name}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Determine report period based on filters
 */
function determineReportPeriod(filters: Record<string, unknown>): {
  periodStart: Date;
  periodEnd: Date;
} {
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date = now;

  if (filters.startDate && filters.endDate) {
    periodStart = new Date(filters.startDate as string);
    periodEnd = new Date(filters.endDate as string);
  } else {
    // Default to last 30 days
    periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 30);
  }

  return { periodStart, periodEnd };
}

/**
 * Generate revenue report
 */
async function generateRevenueReport(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
  format: string,
  filters: Record<string, unknown>
): Promise<ReportExecutionResult> {
  // Get revenue data from bookings
  const bookings = await db.booking.findMany({
    where: {
      tenantId,
      status: { in: ['confirmed', 'checked_in', 'checked_out'] },
      checkIn: { gte: periodStart, lte: periodEnd },
      ...(filters.propertyId ? { propertyId: filters.propertyId as string } : {}),
    },
    include: {
      property: { select: { name: true } },
      roomType: { select: { name: true } },
      primaryGuest: { select: { firstName: true, lastName: true } },
    },
  });

  // Calculate totals
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const totalRoomRate = bookings.reduce((sum, b) => sum + (b.roomRate || 0), 0);
  const totalTaxes = bookings.reduce((sum, b) => sum + (b.taxes || 0), 0);
  const totalFees = bookings.reduce((sum, b) => sum + (b.fees || 0), 0);
  const totalDiscounts = bookings.reduce((sum, b) => sum + (b.discount || 0), 0);

  const reportData = {
    title: 'Revenue Report',
    period: { start: periodStart, end: periodEnd },
    generatedAt: new Date(),
    summary: {
      totalBookings: bookings.length,
      totalRevenue,
      totalRoomRate,
      totalTaxes,
      totalFees,
      totalDiscounts,
    },
    bookings: bookings.map(b => ({
      confirmationCode: b.confirmationCode,
      guest: `${b.primaryGuest?.firstName} ${b.primaryGuest?.lastName}`,
      property: b.property?.name,
      roomType: b.roomType?.name,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      roomRate: b.roomRate,
      taxes: b.taxes,
      fees: b.fees,
      totalAmount: b.totalAmount,
    })),
  };

  return generateReportFile(reportData, 'revenue', format);
}

/**
 * Generate occupancy report
 */
async function generateOccupancyReport(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
  format: string,
  filters: Record<string, unknown>
): Promise<ReportExecutionResult> {
  // Get properties
  const properties = await db.property.findMany({
    where: {
      tenantId,
      ...(filters.propertyId ? { id: filters.propertyId as string } : {}),
    },
    include: {
      rooms: true,
    },
  });

  // Get bookings in period
  const bookings = await db.booking.findMany({
    where: {
      tenantId,
      status: { in: ['confirmed', 'checked_in', 'checked_out'] },
      OR: [
        { checkIn: { gte: periodStart, lte: periodEnd } },
        { checkOut: { gte: periodStart, lte: periodEnd } },
        { AND: [{ checkIn: { lte: periodStart } }, { checkOut: { gte: periodEnd } }] },
      ],
    },
  });

  // Calculate occupancy
  const totalRooms = properties.reduce((sum, p) => sum + p.rooms.length, 0);
  const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  const totalRoomNights = totalRooms * daysInPeriod;

  // Calculate occupied nights
  let occupiedNights = 0;
  for (const booking of bookings) {
    const checkIn = new Date(Math.max(booking.checkIn.getTime(), periodStart.getTime()));
    const checkOut = new Date(Math.min(booking.checkOut.getTime(), periodEnd.getTime()));
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    occupiedNights += Math.max(0, nights);
  }

  const occupancyRate = totalRoomNights > 0 ? (occupiedNights / totalRoomNights) * 100 : 0;

  const reportData = {
    title: 'Occupancy Report',
    period: { start: periodStart, end: periodEnd },
    generatedAt: new Date(),
    summary: {
      totalRooms,
      daysInPeriod,
      totalRoomNights,
      occupiedNights,
      occupancyRate: occupancyRate.toFixed(2) + '%',
      totalBookings: bookings.length,
    },
    properties: properties.map(p => ({
      name: p.name,
      totalRooms: p.rooms.length,
    })),
  };

  return generateReportFile(reportData, 'occupancy', format);
}

/**
 * Generate bookings report
 */
async function generateBookingsReport(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
  format: string,
  filters: Record<string, unknown>
): Promise<ReportExecutionResult> {
  const bookings = await db.booking.findMany({
    where: {
      tenantId,
      checkIn: { gte: periodStart, lte: periodEnd },
      ...(filters.propertyId ? { propertyId: filters.propertyId as string } : {}),
      ...(filters.status ? { status: filters.status as string } : {}),
    },
    include: {
      property: { select: { name: true } },
      roomType: { select: { name: true } },
      room: { select: { number: true } },
      primaryGuest: { select: { firstName: true, lastName: true, email: true, phone: true } },
    },
    orderBy: { checkIn: 'asc' },
  });

  // Status breakdown
  const statusCounts = bookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Source breakdown
  const sourceCounts = bookings.reduce((acc, b) => {
    acc[b.source] = (acc[b.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const reportData = {
    title: 'Bookings Report',
    period: { start: periodStart, end: periodEnd },
    generatedAt: new Date(),
    summary: {
      totalBookings: bookings.length,
      byStatus: statusCounts,
      bySource: sourceCounts,
      totalValue: bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
    },
    bookings: bookings.map(b => ({
      confirmationCode: b.confirmationCode,
      status: b.status,
      source: b.source,
      guest: {
        name: `${b.primaryGuest?.firstName} ${b.primaryGuest?.lastName}`,
        email: b.primaryGuest?.email,
        phone: b.primaryGuest?.phone,
      },
      property: b.property?.name,
      roomType: b.roomType?.name,
      room: b.room?.number,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      totalAmount: b.totalAmount,
    })),
  };

  return generateReportFile(reportData, 'bookings', format);
}

/**
 * Generate guests report
 */
async function generateGuestsReport(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
  format: string,
  filters: Record<string, unknown>
): Promise<ReportExecutionResult> {
  const guests = await db.guest.findMany({
    where: {
      tenantId,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    include: {
      _count: { select: { bookings: true } },
    },
  });

  // VIP breakdown
  const vipCount = guests.filter(g => g.isVip).length;

  // Loyalty tier breakdown
  const tierCounts = guests.reduce((acc, g) => {
    acc[g.loyaltyTier] = (acc[g.loyaltyTier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const reportData = {
    title: 'Guests Report',
    period: { start: periodStart, end: periodEnd },
    generatedAt: new Date(),
    summary: {
      totalGuests: guests.length,
      vipGuests: vipCount,
      byLoyaltyTier: tierCounts,
    },
    guests: guests.map(g => ({
      name: `${g.firstName} ${g.lastName}`,
      email: g.email,
      phone: g.phone,
      loyaltyTier: g.loyaltyTier,
      isVip: g.isVip,
      totalStays: g.totalStays,
      totalSpent: g.totalSpent,
      bookingCount: g._count.bookings,
      createdAt: g.createdAt,
    })),
  };

  return generateReportFile(reportData, 'guests', format);
}

/**
 * Generate financial report
 */
async function generateFinancialReport(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
  format: string,
  filters: Record<string, unknown>
): Promise<ReportExecutionResult> {
  // Get payments
  const payments = await db.payment.findMany({
    where: {
      tenantId,
      createdAt: { gte: periodStart, lte: periodEnd },
      status: 'completed',
    },
  });

  // Get folios
  const folios = await db.folio.findMany({
    where: {
      tenantId,
      openedAt: { gte: periodStart, lte: periodEnd },
    },
  });

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalFolioAmount = folios.reduce((sum, f) => sum + f.totalAmount, 0);
  const totalPaid = folios.reduce((sum, f) => sum + f.paidAmount, 0);
  const totalOutstanding = folios.reduce((sum, f) => sum + f.balance, 0);

  // Payment method breakdown
  const methodCounts = payments.reduce((acc, p) => {
    acc[p.method] = (acc[p.method] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);

  const reportData = {
    title: 'Financial Report',
    period: { start: periodStart, end: periodEnd },
    generatedAt: new Date(),
    summary: {
      totalPayments,
      totalFolioAmount,
      totalPaid,
      totalOutstanding,
      byPaymentMethod: methodCounts,
    },
    payments: payments.map(p => ({
      amount: p.amount,
      method: p.method,
      status: p.status,
      createdAt: p.createdAt,
    })),
  };

  return generateReportFile(reportData, 'financial', format);
}

/**
 * Generate housekeeping report
 */
async function generateHousekeepingReport(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
  format: string,
  filters: Record<string, unknown>
): Promise<ReportExecutionResult> {
  const tasks = await db.task.findMany({
    where: {
      tenantId,
      type: 'housekeeping',
      createdAt: { gte: periodStart, lte: periodEnd },
      ...(filters.propertyId ? { propertyId: filters.propertyId as string } : {}),
    },
    include: {
      assignee: { select: { firstName: true, lastName: true } },
      room: { select: { number: true } },
    },
  });

  // Status breakdown
  const statusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Priority breakdown
  const priorityCounts = tasks.reduce((acc, t) => {
    acc[t.priority] = (acc[t.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const reportData = {
    title: 'Housekeeping Report',
    period: { start: periodStart, end: periodEnd },
    generatedAt: new Date(),
    summary: {
      totalTasks: tasks.length,
      byStatus: statusCounts,
      byPriority: priorityCounts,
    },
    tasks: tasks.map(t => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      room: t.room?.number,
      assignee: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : null,
      scheduledAt: t.scheduledAt,
      completedAt: t.completedAt,
    })),
  };

  return generateReportFile(reportData, 'housekeeping', format);
}

/**
 * Generate a generic report (fallback)
 */
async function generateGenericReport(
  tenantId: string,
  reportType: string,
  periodStart: Date,
  periodEnd: Date,
  format: string,
  filters: Record<string, unknown>
): Promise<ReportExecutionResult> {
  const reportData = {
    title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
    period: { start: periodStart, end: periodEnd },
    generatedAt: new Date(),
    message: 'Report type not fully implemented',
  };

  return generateReportFile(reportData, reportType, format);
}

/**
 * Generate the actual report file
 */
function generateReportFile(
  data: unknown,
  reportType: string,
  format: string
): ReportExecutionResult {
  try {
    let fileContent: Buffer;
    let fileUrl: string | undefined;

    switch (format.toLowerCase()) {
      case 'csv':
        fileContent = generateCSV(data);
        fileUrl = `/reports/${reportType}-${Date.now()}.csv`;
        break;

      case 'excel':
      case 'xlsx':
        fileContent = generateExcel(data);
        fileUrl = `/reports/${reportType}-${Date.now()}.xlsx`;
        break;

      case 'pdf':
      default:
        fileContent = generatePDF(data);
        fileUrl = `/reports/${reportType}-${Date.now()}.pdf`;
    }

    return {
      success: true,
      fileUrl,
      fileContent,
      fileSize: fileContent.length,
      sentAt: new Date(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate file',
    };
  }
}

/**
 * Generate CSV content
 */
function generateCSV(data: unknown): Buffer {
  const reportData = data as Record<string, unknown>;
  let csv = '';

  // Title
  csv += `"${(reportData.title as string) || 'Report'}"\n`;
  csv += `"Generated: ${new Date().toISOString()}"\n\n`;

  // Summary
  if (reportData.summary) {
    csv += 'Summary\n';
    const summary = reportData.summary as Record<string, unknown>;
    for (const [key, value] of Object.entries(summary)) {
      csv += `"${key}","${value}"\n`;
    }
    csv += '\n';
  }

  // Data rows
  if (Array.isArray(reportData.bookings)) {
    csv += 'Bookings\n';
    if (reportData.bookings.length > 0) {
      const headers = Object.keys(reportData.bookings[0]);
      csv += headers.map(h => `"${h}"`).join(',') + '\n';
      for (const row of reportData.bookings) {
        csv += Object.values(row).map(v => `"${v}"`).join(',') + '\n';
      }
    }
  } else if (Array.isArray(reportData.tasks)) {
    csv += 'Tasks\n';
    if (reportData.tasks.length > 0) {
      const headers = Object.keys(reportData.tasks[0]);
      csv += headers.map(h => `"${h}"`).join(',') + '\n';
      for (const row of reportData.tasks) {
        csv += Object.values(row).map(v => `"${v}"`).join(',') + '\n';
      }
    }
  } else if (Array.isArray(reportData.guests)) {
    csv += 'Guests\n';
    if (reportData.guests.length > 0) {
      const headers = Object.keys(reportData.guests[0]);
      csv += headers.map(h => `"${h}"`).join(',') + '\n';
      for (const row of reportData.guests) {
        csv += Object.values(row).map(v => `"${v}"`).join(',') + '\n';
      }
    }
  } else if (Array.isArray(reportData.payments)) {
    csv += 'Payments\n';
    if (reportData.payments.length > 0) {
      const headers = Object.keys(reportData.payments[0]);
      csv += headers.map(h => `"${h}"`).join(',') + '\n';
      for (const row of reportData.payments) {
        csv += Object.values(row).map(v => `"${v}"`).join(',') + '\n';
      }
    }
  }

  return Buffer.from(csv, 'utf-8');
}

/**
 * Generate Excel content (simplified - returns CSV with xlsx extension hint)
 * In production, you'd use a library like exceljs
 */
function generateExcel(data: unknown): Buffer {
  // For now, return CSV content
  // In production, implement proper Excel generation
  return generateCSV(data);
}

/**
 * Generate PDF content (simplified)
 * In production, you'd use a library like pdfkit
 */
function generatePDF(data: unknown): Buffer {
  const reportData = data as Record<string, unknown>;
  let content = '';

  // Simple text-based PDF simulation
  content += `${(reportData.title as string) || 'Report'}\n`;
  content += `Generated: ${new Date().toISOString()}\n`;
  content += `Period: ${(reportData.period as { start: Date; end: Date })?.start?.toISOString?.() || 'N/A'} to ${(reportData.period as { start: Date; end: Date })?.end?.toISOString?.() || 'N/A'}\n\n`;

  if (reportData.summary) {
    content += 'Summary:\n';
    const summary = reportData.summary as Record<string, unknown>;
    for (const [key, value] of Object.entries(summary)) {
      content += `  ${key}: ${value}\n`;
    }
  }

  // In production, use pdfkit or similar to generate actual PDF
  return Buffer.from(content, 'utf-8');
}

/**
 * Send report via email
 */
export async function sendReportEmail(options: EmailOptions): Promise<boolean> {
  try {
    const { to, reportName, reportType, fileUrl, fileContent, format } = options;

    const subject = `${reportName} - ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;
    const body = `
      <h2>${reportName}</h2>
      <p>Your scheduled report has been generated.</p>
      <p><strong>Report Type:</strong> ${reportType}</p>
      <p><strong>Generated At:</strong> ${new Date().toISOString()}</p>
      ${fileUrl ? `<p><a href="${fileUrl}">Download Report</a></p>` : ''}
      <p>This is an automated email from StaySuite.</p>
    `;

    // For now, just log the email details
    // In production, implement actual email sending
    console.log('[ReportExecutor] Sending email:', {
      to,
      subject,
      hasAttachment: !!fileContent,
      format,
    });

    // If email adapter is available, use it
    if (typeof sendEmail === 'function') {
      for (const recipient of to) {
        await sendEmail({
          to: recipient,
          subject,
          html: body,
          attachments: fileContent ? [{
            filename: `${reportType}-report.${format}`,
            content: fileContent,
          }] : undefined,
        });
      }
    }

    return true;
  } catch (error) {
    console.error('[ReportExecutor] Error sending email:', error);
    return false;
  }
}
