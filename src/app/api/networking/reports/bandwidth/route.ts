import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';

    const dailyData = await db.bandwidthUsageDaily.findMany({
      where: { tenantId: user.tenantId, propertyId },
      orderBy: { date: 'desc' },
      take: 30,
    });

    if (dailyData.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const formatted = dailyData.map((d) => ({
      date: d.date.toISOString().split('T')[0],
      downloadMb: d.totalDownloadMb,
      uploadMb: d.totalUploadMb,
      uniqueUsers: d.uniqueUsers,
      peakUsers: d.peakUsers,
      peakTime: d.peakTime,
    }));

    return NextResponse.json({ data: formatted });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch bandwidth report' }, { status: 500 });
  }
}
