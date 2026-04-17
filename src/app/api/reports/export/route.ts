import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import {
  generateCSV,
  generateHTMLTable,
  generateExcelXML,
  getMimeType,
  getFileExtension,
  ColumnDefinition,
  ExportOptions,
} from '@/lib/reports/export-utils';

// Report type configurations
const REPORT_CONFIGS: Record<string, {
  title: string;
  columns: ColumnDefinition[];
  getData: (params: Record<string, string | undefined>) => Promise<Record<string, unknown>[]>;
}> = {
  revenue: {
    title: 'Revenue Report',
    columns: [
      { key: 'date', label: 'Date', format: 'date', width: 120 },
      { key: 'roomRevenue', label: 'Room Revenue', format: 'currency', align: 'right', width: 120 },
      { key: 'foodRevenue', label: 'F&B Revenue', format: 'currency', align: 'right', width: 120 },
      { key: 'otherRevenue', label: 'Other Revenue', format: 'currency', align: 'right', width: 120 },
      { key: 'totalRevenue', label: 'Total Revenue', format: 'currency', align: 'right', width: 130 },
      { key: 'adr', label: 'ADR', format: 'currency', align: 'right', width: 100 },
      { key: 'revpar', label: 'RevPAR', format: 'currency', align: 'right', width: 100 },
    ],
    getData: async (params) => {
      const { tenantId, propertyId, startDate, endDate } = params;
      const where: Record<string, unknown> = { tenantId };
      if (propertyId) where.propertyId = propertyId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
        if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
      }

      // Get actual payment data
      const payments = await db.payment.findMany({
        where: { ...where, status: 'completed' },
        include: {
          folio: {
            select: {
              booking: { select: { propertyId: true } },
            },
          },
        },
      });

      // Group by date
      const byDate: Record<string, Record<string, unknown>> = {};
      payments.forEach((payment) => {
        const date = payment.createdAt.toISOString().split('T')[0];
        if (!byDate[date]) {
          byDate[date] = { date, roomRevenue: 0, foodRevenue: 0, otherRevenue: 0, totalRevenue: 0 };
        }
        const amount = payment.amount;

        // Classify revenue by folio charge type if available
        const chargeType = (payment as Record<string, unknown>).chargeType as string || (payment as Record<string, unknown>).category as string || '';
        if (chargeType === 'food_beverage' || chargeType === 'restaurant' || chargeType === 'f&b' || chargeType === 'fnb') {
          byDate[date].foodRevenue = (byDate[date].foodRevenue as number) + amount;
        } else if (chargeType === 'other' || chargeType === 'service' || chargeType === 'amenity') {
          byDate[date].otherRevenue = (byDate[date].otherRevenue as number) + amount;
        } else {
          // Default to room revenue for unclassified payments
          byDate[date].roomRevenue = (byDate[date].roomRevenue as number) + amount;
        }
        byDate[date].totalRevenue = (byDate[date].totalRevenue as number) + amount;
      });

      return Object.values(byDate).sort((a, b) => 
        (a.date as string).localeCompare(b.date as string)
      );
    },
  },
  occupancy: {
    title: 'Occupancy Report',
    columns: [
      { key: 'date', label: 'Date', format: 'date', width: 120 },
      { key: 'totalRooms', label: 'Total Rooms', format: 'number', align: 'right', width: 100 },
      { key: 'occupiedRooms', label: 'Occupied', format: 'number', align: 'right', width: 100 },
      { key: 'availableRooms', label: 'Available', format: 'number', align: 'right', width: 100 },
      { key: 'occupancyRate', label: 'Occupancy %', format: 'percentage', align: 'right', width: 110 },
      { key: 'arrivals', label: 'Arrivals', format: 'number', align: 'center', width: 90 },
      { key: 'departures', label: 'Departures', format: 'number', align: 'center', width: 100 },
    ],
    getData: async (params) => {
      const { tenantId, propertyId, startDate, endDate } = params;
      const where: Record<string, unknown> = { tenantId };
      if (propertyId) where.propertyId = propertyId;

      // Get rooms
      const rooms = await db.room.findMany({ where });
      const totalRooms = rooms.length;

      // Get bookings
      const bookingWhere: Record<string, unknown> = { tenantId };
      if (propertyId) bookingWhere.propertyId = propertyId;
      if (startDate || endDate) {
        bookingWhere.checkIn = {};
        if (startDate) (bookingWhere.checkIn as Record<string, unknown>).gte = new Date(startDate);
        if (endDate) (bookingWhere.checkIn as Record<string, unknown>).lte = new Date(endDate);
      }

      const bookings = await db.booking.findMany({
        where: bookingWhere,
        select: { checkIn: true, checkOut: true, status: true },
      });

      // Group by date
      const byDate: Record<string, Record<string, unknown>> = {};
      const start = startDate ? new Date(startDate) : new Date();
      const end = endDate ? new Date(endDate) : new Date();
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        byDate[dateStr] = {
          date: dateStr,
          totalRooms,
          occupiedRooms: 0,
          availableRooms: totalRooms,
          occupancyRate: 0,
          arrivals: 0,
          departures: 0,
        };
      }

      bookings.forEach((booking) => {
        const checkInStr = booking.checkIn.toISOString().split('T')[0];
        const checkOutStr = booking.checkOut.toISOString().split('T')[0];
        
        if (byDate[checkInStr]) {
          (byDate[checkInStr].arrivals as number)++;
        }
        if (byDate[checkOutStr]) {
          (byDate[checkOutStr].departures as number)++;
        }

        // Count occupied nights
        const nights: string[] = [];
        for (let d = new Date(booking.checkIn); d < booking.checkOut; d.setDate(d.getDate() + 1)) {
          nights.push(d.toISOString().split('T')[0]);
        }
        nights.forEach((date) => {
          if (byDate[date]) {
            (byDate[date].occupiedRooms as number)++;
            (byDate[date].availableRooms as number)--;
            (byDate[date].occupancyRate as number) = ((byDate[date].occupiedRooms as number) / totalRooms) * 100;
          }
        });
      });

      return Object.values(byDate).sort((a, b) => 
        (a.date as string).localeCompare(b.date as string)
      );
    },
  },
  guests: {
    title: 'Guest Analytics Report',
    columns: [
      { key: 'guestId', label: 'Guest ID', width: 100 },
      { key: 'guestName', label: 'Guest Name', width: 150 },
      { key: 'email', label: 'Email', width: 180 },
      { key: 'totalStays', label: 'Total Stays', format: 'number', align: 'center', width: 100 },
      { key: 'totalSpent', label: 'Total Spent', format: 'currency', align: 'right', width: 120 },
      { key: 'loyaltyTier', label: 'Loyalty Tier', align: 'center', width: 100 },
      { key: 'lastStay', label: 'Last Stay', format: 'date', width: 120 },
    ],
    getData: async (params) => {
      const { tenantId, limit } = params;
      
      const guests = await db.guest.findMany({
        where: { tenantId },
        include: {
          bookings: {
            select: { id: true, checkOut: true, folios: { select: { totalAmount: true } } },
            orderBy: { checkOut: 'desc' },
            take: 1,
          },
          _count: { select: { bookings: true } },
        },
        take: limit ? parseInt(limit) : 100,
      });

      return guests.map((guest) => ({
        guestId: guest.id.substring(0, 8),
        guestName: `${guest.firstName} ${guest.lastName}`,
        email: guest.email,
        totalStays: guest._count.bookings,
        totalSpent: guest.bookings.reduce((sum, b) => 
          sum + b.folios.reduce((s, f) => s + f.totalAmount, 0), 0
        ),
        loyaltyTier: guest.loyaltyTier || 'Bronze',
        lastStay: guest.bookings[0]?.checkOut || null,
      }));
    },
  },
  bookings: {
    title: 'Bookings Report',
    columns: [
      { key: 'confirmationCode', label: 'Confirmation', width: 120 },
      { key: 'guestName', label: 'Guest Name', width: 150 },
      { key: 'checkIn', label: 'Check In', format: 'date', width: 100 },
      { key: 'checkOut', label: 'Check Out', format: 'date', width: 100 },
      { key: 'roomType', label: 'Room Type', width: 120 },
      { key: 'roomNumber', label: 'Room', width: 80 },
      { key: 'totalAmount', label: 'Total', format: 'currency', align: 'right', width: 100 },
      { key: 'status', label: 'Status', align: 'center', width: 100 },
      { key: 'source', label: 'Source', width: 100 },
    ],
    getData: async (params) => {
      const { tenantId, propertyId, startDate, endDate, limit } = params;
      
      const where: Record<string, unknown> = { tenantId };
      if (propertyId) where.propertyId = propertyId;
      if (startDate || endDate) {
        where.checkIn = {};
        if (startDate) (where.checkIn as Record<string, unknown>).gte = new Date(startDate);
        if (endDate) (where.checkIn as Record<string, unknown>).lte = new Date(endDate);
      }

      const bookings = await db.booking.findMany({
        where,
        include: {
          primaryGuest: { select: { firstName: true, lastName: true } },
          room: { select: { number: true } },
          roomType: { select: { name: true } },
          folios: { select: { totalAmount: true } },
        },
        orderBy: { checkIn: 'desc' },
        take: limit ? parseInt(limit) : 500,
      });

      return bookings.map((booking) => ({
        confirmationCode: booking.confirmationCode,
        guestName: `${booking.primaryGuest?.firstName || ''} ${booking.primaryGuest?.lastName || ''}`.trim(),
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomType: booking.roomType?.name || 'N/A',
        roomNumber: booking.room?.number || 'N/A',
        totalAmount: booking.folios.reduce((sum, f) => sum + f.totalAmount, 0),
        status: booking.status,
        source: booking.source || 'Direct',
      }));
    },
  },
  staff: {
    title: 'Staff Performance Report',
    columns: [
      { key: 'staffId', label: 'ID', width: 80 },
      { key: 'staffName', label: 'Name', width: 150 },
      { key: 'department', label: 'Department', width: 120 },
      { key: 'tasksCompleted', label: 'Tasks Done', format: 'number', align: 'center', width: 100 },
      { key: 'avgRating', label: 'Avg Rating', format: 'number', align: 'center', width: 100 },
      { key: 'attendanceRate', label: 'Attendance %', format: 'percentage', align: 'center', width: 110 },
      { key: 'hoursWorked', label: 'Hours', format: 'number', align: 'center', width: 80 },
    ],
    getData: async (params) => {
      const { tenantId, startDate, endDate } = params;
      
      const staff = await db.user.findMany({
        where: { tenantId },
        include: {
          tasks: {
            where: {
              status: 'completed',
              ...(startDate || endDate ? {
                completedAt: {
                  ...(startDate ? { gte: new Date(startDate) } : {}),
                  ...(endDate ? { lte: new Date(endDate) } : {}),
                },
              } : {}),
            },
          },
          attendance: {
            where: {
              ...(startDate || endDate ? {
                date: {
                  ...(startDate ? { gte: new Date(startDate) } : {}),
                  ...(endDate ? { lte: new Date(endDate) } : {}),
                },
              } : {}),
            },
          },
        },
      });

      return staff.map((user) => {
        const totalDays = user.attendance.length;
        const presentDays = user.attendance.filter((a) => a.status === 'present').length;
        
        return {
          staffId: user.id.substring(0, 8),
          staffName: `${user.firstName} ${user.lastName}`,
          department: user.department || 'General',
          tasksCompleted: user.tasks.length,
          avgRating: 0,
          attendanceRate: totalDays > 0 ? (presentDays / totalDays) * 100 : 0,
          hoursWorked: 0,
        };
      });
    },
  },
};

// GET /api/reports/export - Export a report
export async function GET(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['reports.export', 'admin.reports', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }


  try {
    const searchParams = request.nextUrl.searchParams;
    const reportType = searchParams.get('type') || 'revenue';
    const format = (searchParams.get('format') || 'csv') as 'csv' | 'pdf' | 'excel';
    const tenantId = user.tenantId;
    const propertyId = searchParams.get('propertyId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const limit = searchParams.get('limit') || undefined;

    // Validate report type
    const config = REPORT_CONFIGS[reportType];
    if (!config) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REPORT_TYPE', message: `Invalid report type. Available: ${Object.keys(REPORT_CONFIGS).join(', ')}` } },
        { status: 400 }
      );
    }

    // Get data
    const data = await config.getData({
      tenantId,
      propertyId,
      startDate,
      endDate,
      limit,
    });

    // Export options
    const options: ExportOptions = {
      format,
      title: config.title,
      dateRange: startDate && endDate ? { start: new Date(startDate), end: new Date(endDate) } : undefined,
      propertyId,
      tenantId,
    };

    // Generate export content
    let content: string;
    let filename: string;

    switch (format) {
      case 'csv':
        content = generateCSV(data, config.columns);
        filename = `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
        break;
      case 'pdf':
        content = generateHTMLTable(data, config.columns, options);
        filename = `${reportType}_report_${new Date().toISOString().split('T')[0]}.html`;
        break;
      case 'excel':
        content = generateExcelXML(data, config.columns, options);
        filename = `${reportType}_report_${new Date().toISOString().split('T')[0]}.xls`;
        break;
      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_FORMAT', message: 'Invalid export format' } },
          { status: 400 }
        );
    }

    // Return the file
    return new NextResponse(content, {
      headers: {
        'Content-Type': getMimeType(format),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error exporting report:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to export report' } },
      { status: 500 }
    );
  }
}
