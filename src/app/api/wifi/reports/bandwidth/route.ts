import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/reports/bandwidth - Daily bandwidth usage with date range
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'reports.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;

    // Date range filtering
    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate);
    }

    const bandwidthData = await db.bandwidthUsageDaily.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    // If DB has data, format it for the frontend
    if (bandwidthData.length > 0) {
      const formatted = bandwidthData.map((d) => ({
        date: d.date.toISOString().split('T')[0],
        download: d.totalDownloadMb || 0,
        upload: d.totalUploadMb || 0,
        total: (d.totalDownloadMb || 0) + (d.totalUploadMb || 0),
        users: d.uniqueUsers || 0,
        peakTime: d.peakTime || '20:00',
      }));

      return NextResponse.json({ success: true, data: formatted });
    }

    // No data found in database
    return NextResponse.json({ success: true, data: [] });
  } catch (error) {
    console.error('Error fetching bandwidth report:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bandwidth report' } },
      { status: 500 }
    );
  }
}
