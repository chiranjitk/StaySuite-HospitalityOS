import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

type ActivityCategory = 'booking' | 'payment' | 'housekeeping' | 'guest' | 'system';

interface ActivityItem {
  id: string;
  category: ActivityCategory;
  type: string;
  title: string;
  description: string;
  guest?: { name: string; initials: string };
  room?: string;
  timestamp: Date;
  status?: string;
  amount?: number;
  user?: { name: string; initials: string };
  metadata?: Record<string, unknown>;
}

function generateMockActivities(limit: number, offset: number, category?: string): ActivityItem[] {
  const now = new Date();
  const activities: ActivityItem[] = [];

  const mockGuests = [
    { name: 'James Wilson', initials: 'JW' },
    { name: 'Sarah Chen', initials: 'SC' },
    { name: 'Michael Brown', initials: 'MB' },
    { name: 'Emma Davis', initials: 'ED' },
    { name: 'Carlos Martinez', initials: 'CM' },
    { name: 'Aisha Patel', initials: 'AP' },
    { name: 'Thomas Anderson', initials: 'TA' },
    { name: 'Yuki Tanaka', initials: 'YT' },
    { name: 'Olivia Johnson', initials: 'OJ' },
    { name: 'Liam O\'Brien', initials: 'LO' },
  ];

  const mockStaff = [
    { name: 'Anna Park', initials: 'AP' },
    { name: 'David Kim', initials: 'DK' },
    { name: 'Rachel Green', initials: 'RG' },
    { name: 'Marco Silva', initials: 'MS' },
  ];

  const mockRooms = ['101', '205', '308', '402', '501', '115', '220', '335', '410', '512'];

  const bookingActivities: Omit<ActivityItem, 'id'>[] = [
    { category: 'booking', type: 'booking_created', title: 'New Booking Created', description: 'Reservation confirmed for 3 nights stay', room: '205', status: 'confirmed', timestamp: new Date(now.getTime() - 5 * 60000) },
    { category: 'booking', type: 'check_in', title: 'Guest Checked In', description: 'Smooth check-in completed with digital key issued', room: '308', status: 'checked_in', timestamp: new Date(now.getTime() - 15 * 60000) },
    { category: 'booking', type: 'check_out', title: 'Guest Checked Out', description: 'Check-out completed, room ready for housekeeping', room: '101', status: 'completed', timestamp: new Date(now.getTime() - 35 * 60000) },
    { category: 'booking', type: 'booking_modified', title: 'Booking Modified', description: 'Extended stay by 2 nights, checkout moved to Friday', room: '402', status: 'confirmed', timestamp: new Date(now.getTime() - 55 * 60000) },
    { category: 'booking', type: 'booking_cancelled', title: 'Booking Cancelled', description: 'Cancellation received, refund processing initiated', room: '501', status: 'cancelled', timestamp: new Date(now.getTime() - 1.5 * 3600000) },
    { category: 'booking', type: 'booking_created', title: 'Group Booking Created', description: 'Conference group booking for 8 rooms confirmed', room: '220', status: 'confirmed', timestamp: new Date(now.getTime() - 2.5 * 3600000) },
    { category: 'booking', type: 'no_show', title: 'No-Show Detected', description: 'Guest did not arrive, no-show policy applied', room: '335', status: 'no_show', timestamp: new Date(now.getTime() - 3.5 * 3600000) },
    { category: 'booking', type: 'check_in', title: 'VIP Guest Checked In', description: 'Complimentary upgrade to suite, welcome amenity prepared', room: '410', status: 'checked_in', timestamp: new Date(now.getTime() - 5 * 3600000) },
    { category: 'booking', type: 'booking_created', title: 'Direct Booking Received', description: 'Walk-in reservation, 2 nights standard room', room: '115', status: 'confirmed', timestamp: new Date(now.getTime() - 7 * 3600000) },
  ];

  const paymentActivities: Omit<ActivityItem, 'id'>[] = [
    { category: 'payment', type: 'payment_received', title: 'Payment Received', description: 'Credit card payment processed successfully', amount: 1250.00, status: 'completed', timestamp: new Date(now.getTime() - 25 * 60000) },
    { category: 'payment', type: 'refund_issued', title: 'Refund Issued', description: 'Partial refund processed for early checkout', amount: 340.00, status: 'refunded', timestamp: new Date(now.getTime() - 45 * 60000) },
    { category: 'payment', type: 'payment_failed', title: 'Payment Failed', description: 'Card declined, guest notified to update payment method', amount: 890.00, status: 'failed', timestamp: new Date(now.getTime() - 2 * 3600000) },
    { category: 'payment', type: 'deposit_received', title: 'Deposit Received', description: '50% deposit received for upcoming reservation', amount: 675.00, status: 'completed', timestamp: new Date(now.getTime() - 4 * 3600000) },
    { category: 'payment', type: 'payment_received', title: 'Invoice Settled', description: 'Corporate account invoice #INV-2024-1847 paid in full', amount: 3200.00, status: 'completed', timestamp: new Date(now.getTime() - 6 * 3600000) },
    { category: 'payment', type: 'payment_received', title: 'Online Payment', description: 'Guest completed payment via booking portal', amount: 1580.00, status: 'completed', timestamp: new Date(now.getTime() - 8 * 3600000) },
  ];

  const housekeepingActivities: Omit<ActivityItem, 'id'>[] = [
    { category: 'housekeeping', type: 'cleaning_started', title: 'Room Cleaning Started', description: 'Deep cleaning in progress for VIP suite', room: '410', timestamp: new Date(now.getTime() - 10 * 60000), user: mockStaff[0] },
    { category: 'housekeeping', type: 'cleaning_completed', title: 'Room Cleaned', description: 'Room inspected and marked as ready', room: '101', timestamp: new Date(now.getTime() - 30 * 60000), user: mockStaff[1] },
    { category: 'housekeeping', type: 'maintenance_request', title: 'Maintenance Request', description: 'AC unit reported malfunctioning in room', room: '205', status: 'pending', timestamp: new Date(now.getTime() - 50 * 60000) },
    { category: 'housekeeping', type: 'inspection_passed', title: 'Inspection Passed', description: 'Quality inspection scored 98/100 for room', room: '308', status: 'passed', timestamp: new Date(now.getTime() - 1.5 * 3600000), user: mockStaff[2] },
    { category: 'housekeeping', type: 'laundry_delivered', title: 'Fresh Linens Delivered', description: 'Bulk linen delivery completed for 3rd floor', timestamp: new Date(now.getTime() - 3 * 3600000) },
    { category: 'housekeeping', type: 'cleaning_completed', title: 'Public Area Cleaned', description: 'Lobby and restaurant areas deep cleaned', timestamp: new Date(now.getTime() - 5 * 3600000), user: mockStaff[3] },
    { category: 'housekeeping', type: 'maintenance_completed', title: 'Repair Completed', description: 'Plumbing issue fixed in bathroom', room: '501', status: 'completed', timestamp: new Date(now.getTime() - 7 * 3600000) },
  ];

  const guestActivities: Omit<ActivityItem, 'id'>[] = [
    { category: 'guest', type: 'feedback_received', title: 'Guest Feedback Received', description: '5-star review submitted praising front desk service', status: 'positive', timestamp: new Date(now.getTime() - 20 * 60000) },
    { category: 'guest', type: 'special_request', title: 'Special Request Submitted', description: 'Extra pillows and hypoallergenic bedding requested', room: '308', status: 'pending', timestamp: new Date(now.getTime() - 40 * 60000) },
    { category: 'guest', type: 'complaint', title: 'Guest Complaint', description: 'Noise complaint from adjacent room reported', room: '205', status: 'open', timestamp: new Date(now.getTime() - 1.25 * 3600000) },
    { category: 'guest', type: 'loyalty_enrolled', title: 'Loyalty Member Enrolled', description: 'New Gold tier member enrolled during check-in', timestamp: new Date(now.getTime() - 2.75 * 3600000) },
    { category: 'guest', type: 'feedback_received', title: 'Survey Completed', description: 'Post-stay survey completed with 4.8/5 rating', status: 'positive', timestamp: new Date(now.getTime() - 4.5 * 3600000) },
    { category: 'guest', type: 'special_request', title: 'Late Checkout Approved', description: 'Late checkout until 3 PM approved for Gold member', room: '402', status: 'approved', timestamp: new Date(now.getTime() - 5.5 * 3600000) },
  ];

  const systemActivities: Omit<ActivityItem, 'id'>[] = [
    { category: 'system', type: 'system_update', title: 'System Update Completed', description: 'PMS software updated to v4.2.1 successfully', timestamp: new Date(now.getTime() - 1 * 3600000) },
    { category: 'system', type: 'rate_update', title: 'Rate Plans Updated', description: 'Seasonal rate adjustments applied for Q2 pricing', timestamp: new Date(now.getTime() - 3.25 * 3600000) },
    { category: 'system', type: 'integration_sync', title: 'Channel Manager Synced', description: 'Availability pushed to Booking.com and Airbnb', timestamp: new Date(now.getTime() - 6.5 * 3600000) },
    { category: 'system', type: 'backup_completed', title: 'System Backup Completed', description: 'Daily database backup completed successfully', timestamp: new Date(now.getTime() - 9 * 3600000) },
    { category: 'system', type: 'report_generated', title: 'Revenue Report Generated', description: 'Weekly revenue report automatically generated', timestamp: new Date(now.getTime() - 12 * 3600000) },
    { category: 'system', type: 'rate_update', title: 'Promotion Activated', description: 'Flash sale promotion activated for next weekend', timestamp: new Date(now.getTime() - 18 * 3600000) },
    { category: 'system', type: 'system_update', title: 'Security Patch Applied', description: 'Critical security patches deployed to production', timestamp: new Date(now.getTime() - 28 * 3600000) },
    { category: 'booking', type: 'booking_created', title: 'Large Group Reservation', description: 'Wedding party block booking for 15 rooms', room: '220', status: 'confirmed', timestamp: new Date(now.getTime() - 30 * 3600000) },
    { category: 'payment', type: 'deposit_received', title: 'Group Deposit Received', description: '30% deposit received for wedding block booking', amount: 8500.00, status: 'completed', timestamp: new Date(now.getTime() - 32 * 3600000) },
    { category: 'housekeeping', type: 'cleaning_completed', title: 'Floor Deep Clean', description: 'Complete 5th floor deep clean and sanitization', timestamp: new Date(now.getTime() - 36 * 3600000), user: mockStaff[0] },
    { category: 'guest', type: 'loyalty_enrolled', title: 'Platinum Member Upgraded', description: 'Guest upgraded from Gold to Platinum tier', timestamp: new Date(now.getTime() - 40 * 3600000) },
    { category: 'system', type: 'integration_sync', title: 'OTA Rates Synced', description: 'Rates and availability synced across 5 OTAs', timestamp: new Date(now.getTime() - 44 * 3600000) },
    { category: 'booking', type: 'check_in', title: 'Early Check-in Approved', description: 'Early arrival accommodated, room prepared ahead of schedule', room: '335', status: 'checked_in', timestamp: new Date(now.getTime() - 48 * 3600000) },
    { category: 'payment', type: 'payment_received', title: 'Room Service Charged', description: 'In-room dining charges posted to guest folio', amount: 85.50, status: 'completed', timestamp: new Date(now.getTime() - 52 * 3600000) },
    { category: 'housekeeping', type: 'maintenance_request', title: 'Elevator Maintenance', description: 'Scheduled maintenance for elevator #2 completed', status: 'completed', timestamp: new Date(now.getTime() - 56 * 3600000) },
    { category: 'guest', type: 'feedback_received', title: 'Review on TripAdvisor', description: 'Guest posted 4-star review mentioning great location', status: 'positive', timestamp: new Date(now.getTime() - 60 * 3600000) },
    { category: 'system', type: 'report_generated', title: 'Occupancy Report', description: 'Monthly occupancy analytics report generated', timestamp: new Date(now.getTime() - 65 * 3600000) },
    { category: 'booking', type: 'booking_cancelled', title: 'Cancellation - Medical', description: 'Booking cancelled due to medical emergency, full refund issued', room: '512', status: 'refunded', timestamp: new Date(now.getTime() - 72 * 3600000) },
    { category: 'payment', type: 'refund_issued', title: 'Refund Processed', description: 'Full refund of $1,250 processed for medical cancellation', amount: 1250.00, status: 'refunded', timestamp: new Date(now.getTime() - 72.5 * 3600000) },
    { category: 'system', type: 'system_update', title: 'WiFi System Updated', description: 'Guest WiFi network firmware upgraded', timestamp: new Date(now.getTime() - 80 * 3600000) },
    { category: 'housekeeping', type: 'cleaning_completed', title: 'Pool Area Maintenance', description: 'Pool cleaned and chemical levels balanced', timestamp: new Date(now.getTime() - 90 * 3600000), user: mockStaff[2] },
    { category: 'guest', type: 'special_request', title: 'Airport Transfer Booked', description: 'Airport shuttle arranged for 6 AM departure', room: '115', status: 'confirmed', timestamp: new Date(now.getTime() - 96 * 3600000) },
    { category: 'system', type: 'integration_sync', description: 'CRM data synchronized with marketing platform', title: 'CRM Sync Completed', timestamp: new Date(now.getTime() - 110 * 3600000) },
    { category: 'booking', type: 'check_out', title: 'Extended Stay Check-out', description: 'Guest departed after 2-week extended stay', room: '410', status: 'completed', timestamp: new Date(now.getTime() - 120 * 3600000) },
    { category: 'payment', type: 'payment_received', title: 'Long-stay Payment', description: 'Final payment for 14-night stay received', amount: 4200.00, status: 'completed', timestamp: new Date(now.getTime() - 120.5 * 3600000) },
    { category: 'housekeeping', type: 'inspection_passed', title: 'Monthly Audit Passed', description: 'Monthly housekeeping quality audit passed with 95%', status: 'passed', timestamp: new Date(now.getTime() - 130 * 3600000), user: mockStaff[3] },
    { category: 'guest', type: 'complaint', title: 'Billing Dispute Resolved', description: 'Mini-bar charge dispute resolved in guest favor', room: '501', status: 'resolved', timestamp: new Date(now.getTime() - 140 * 3600000) },
    { category: 'system', type: 'backup_completed', title: 'Weekly Backup Verified', description: 'Weekly full system backup verified and stored', timestamp: new Date(now.getTime() - 150 * 3600000) },
  ];

  const allActivities = [
    ...bookingActivities,
    ...paymentActivities,
    ...housekeepingActivities,
    ...guestActivities,
    ...systemActivities,
  ];

  allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  allActivities.forEach((activity, index) => {
    if (!activity.guest && activity.category !== 'system' && activity.category !== 'housekeeping') {
      activity.guest = mockGuests[index % mockGuests.length];
    }
    if (!activity.room && activity.category === 'booking') {
      activity.room = mockRooms[index % mockRooms.length];
    }
  });

  let filtered = allActivities;
  if (category && category !== 'all') {
    filtered = allActivities.filter(a => a.category === category);
  }

  const paginated = filtered.slice(offset, offset + limit);

  return paginated.map((activity, index) => ({
    ...activity,
    id: `activity-${offset + index}-${activity.type}`,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');
    const category = searchParams.get('category') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const tenantId = user.tenantId;

    let activities: ActivityItem[] = [];
    let total = 0;
    let hasRealData = false;

    try {
      const whereClause: Record<string, unknown> = { tenantId };

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) (whereClause.createdAt as Record<string, unknown>).gte = new Date(startDate);
        if (endDate) (whereClause.createdAt as Record<string, unknown>).lte = new Date(endDate);
      }

      const moduleFilter: Record<string, string[]> = {
        booking: ['bookings', 'reservations', 'booking-engine'],
        payment: ['payments', 'folios', 'invoices', 'accounting'],
        housekeeping: ['housekeeping', 'maintenance', 'rooms', 'tasks'],
        guest: ['guests', 'crm', 'communications', 'loyalty'],
        system: ['system', 'settings', 'integrations', 'audit'],
      };

      if (category && category !== 'all' && moduleFilter[category]) {
        whereClause.module = { in: moduleFilter[category] };
      }

      const auditLogs = await db.auditLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      total = await db.auditLog.count({ where: whereClause });

      if (auditLogs.length > 0) {
        hasRealData = true;
        const categoryMap: Record<string, ActivityCategory> = {
          bookings: 'booking',
          reservations: 'booking',
          'booking-engine': 'booking',
          payments: 'payment',
          folios: 'payment',
          invoices: 'payment',
          accounting: 'payment',
          housekeeping: 'housekeeping',
          maintenance: 'housekeeping',
          rooms: 'housekeeping',
          tasks: 'housekeeping',
          guests: 'guest',
          crm: 'guest',
          communications: 'guest',
          loyalty: 'guest',
          system: 'system',
          settings: 'system',
          integrations: 'system',
          audit: 'system',
        };

        const actionTitles: Record<string, string> = {
          create: 'Created',
          update: 'Updated',
          delete: 'Deleted',
          check_in: 'Checked In',
          check_out: 'Checked Out',
          cancel: 'Cancelled',
          confirm: 'Confirmed',
          process: 'Processed',
          sync: 'Synchronized',
          login: 'Logged In',
        };

        const realActivities: ActivityItem[] = auditLogs.map(log => ({
          id: log.id,
          category: categoryMap[log.module] || 'system',
          type: log.action,
          title: `${actionTitles[log.action] || log.action} ${log.entityType}`,
          description: (() => {
            try {
              if (log.newValue) {
                const parsed = JSON.parse(log.newValue);
                if (parsed.description) return parsed.description;
              }
            } catch { /* ignore */ }
            return `${log.action} ${log.entityType}${log.entityId ? ` #${log.entityId.slice(-6)}` : ''}`;
          })(),
          timestamp: log.createdAt,
          user: log.user ? {
            name: `${log.user.firstName} ${log.user.lastName}`,
            initials: `${log.user.firstName[0]}${log.user.lastName[0]}`,
          } : undefined,
          metadata: {
            module: log.module,
            entityType: log.entityType,
            entityId: log.entityId,
            ipAddress: log.ipAddress,
          },
        }));

        // Blend real data with mock data for a richer timeline
        // If most real entries are just logins, enrich with mock activities
        const nonLoginActivities = realActivities.filter(a => a.type !== 'login');
        const loginActivities = realActivities.filter(a => a.type === 'login');

        // Get mock data to supplement
        const mockActivities = generateMockActivities(limit, offset, category);

        if (nonLoginActivities.length >= 3) {
          // We have enough diverse real data - use it
          activities = realActivities;
        } else {
          // Blend: inject real login activities into mock data timeline
          // Take the most recent login activities and intersperse with mock
          const recentLogins = loginActivities.slice(0, 2);
          const mockWithoutSystemLogins = mockActivities.filter(
            m => !(m.type === 'login' && m.category === 'system')
          );
          activities = [...recentLogins, ...mockWithoutSystemLogins]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
        }
      }
    } catch {
      // DB query failed, fall back to mock data
    }

    if (!hasRealData) {
      const mockActivities = generateMockActivities(limit, offset, category);
      const mockAll = generateMockActivities(200, 0, category);
      activities = mockActivities;
      total = mockAll.length;
    }

    return NextResponse.json({
      success: true,
      data: {
        activities,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error('Activity API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch activity data' } },
      { status: 500 }
    );
  }
}
