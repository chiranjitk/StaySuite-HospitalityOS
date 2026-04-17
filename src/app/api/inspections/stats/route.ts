import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/inspections/stats - Inspection statistics
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // RBAC check
    if (
      !hasPermission(currentUser, 'tasks.view') &&
      !hasPermission(currentUser, 'tasks.*') &&
      !hasPermission(currentUser, 'housekeeping.view')
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const inspectorId = searchParams.get('inspectorId');

    // Base where for all queries
    const baseWhere: Record<string, unknown> = {
      tenantId: currentUser.tenantId,
      completedAt: { not: null },
    };

    if (propertyId) baseWhere.propertyId = propertyId;
    if (inspectorId) baseWhere.inspectorId = inspectorId;

    if (dateFrom || dateTo) {
      if (dateFrom) {
        (baseWhere.completedAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (baseWhere.completedAt as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    // 1. Overall stats
    const [totalInspections, passedCount, failedCount, avgScoreResult] =
      await Promise.all([
        db.inspectionResult.count({ where: baseWhere }),
        db.inspectionResult.count({ where: { ...baseWhere, passed: true } }),
        db.inspectionResult.count({ where: { ...baseWhere, passed: false } }),
        db.inspectionResult.aggregate({
          where: baseWhere,
          _avg: { score: true },
        }),
      ]);

    const passRate =
      totalInspections > 0
        ? Math.round((passedCount / totalInspections) * 100)
        : 0;

    // 2. Inspector breakdown (batch lookup to avoid N+1)
    const inspectorBreakdown = await db.inspectionResult.groupBy({
      by: ['inspectorId'],
      where: baseWhere,
      _count: { id: true },
      _avg: { score: true },
    });

    // Batch fetch all inspector user records
    const allInspectorIds = inspectorBreakdown.map(g => g.inspectorId).filter(Boolean);
    const allInspectors = allInspectorIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: allInspectorIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const inspectorMap = new Map(allInspectors.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

    // Batch fetch passed counts per inspector using groupBy
    const inspectorPassedBreakdown = await db.inspectionResult.groupBy({
      by: ['inspectorId'],
      where: { ...baseWhere, passed: true },
      _count: { id: true },
    });
    const passedCountMap = new Map(
      inspectorPassedBreakdown.map(g => [g.inspectorId, g._count.id])
    );

    const inspectorStats = inspectorBreakdown.map(group => {
      const totalInspections = group._count.id;
      const inspectorPassed = passedCountMap.get(group.inspectorId) || 0;
      return {
        inspectorId: group.inspectorId,
        inspectorName: inspectorMap.get(group.inspectorId) || 'Unknown',
        totalInspections,
        avgScore: group._avg.score ? Math.round(group._avg.score) : 0,
        passRate: totalInspections > 0
          ? Math.round((inspectorPassed / totalInspections) * 100)
          : 0,
      };
    });

    // Sort by totalInspections descending
    inspectorStats.sort((a, b) => b.totalInspections - a.totalInspections);

    // 3. Room breakdown - batch lookup to avoid N+1
    const recentInspections = await db.inspectionResult.findMany({
      where: baseWhere,
      distinct: ['roomId'],
      select: {
        roomId: true,
        score: true,
        completedAt: true,
      },
      orderBy: { completedAt: 'desc' },
      take: 50,
    });

    // Batch fetch all room records
    const allRoomIds = recentInspections.map(ri => ri.roomId).filter(Boolean);
    const allRooms = allRoomIds.length > 0
      ? await db.room.findMany({
          where: { id: { in: allRoomIds } },
          select: { id: true, number: true },
        })
      : [];
    const roomMap = new Map(allRooms.map(r => [r.id, r.number]));

    const roomBreakdown = recentInspections.map(inspection => ({
      roomId: inspection.roomId,
      roomNumber: roomMap.get(inspection.roomId) || 'Unknown',
      lastScore: inspection.score,
      lastInspectedAt: inspection.completedAt,
    }));

    // Sort by lastInspectedAt descending
    roomBreakdown.sort(
      (a, b) =>
        new Date(b.lastInspectedAt!).getTime() -
        new Date(a.lastInspectedAt!).getTime()
    );

    // 4. Trend data - daily scores for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const trendWhere: Record<string, unknown> = {
      tenantId: currentUser.tenantId,
      completedAt: { gte: thirtyDaysAgo },
    };

    if (propertyId) trendWhere.propertyId = propertyId;
    if (inspectorId) trendWhere.inspectorId = inspectorId;

    const trendInspections = await db.inspectionResult.findMany({
      where: trendWhere,
      select: {
        completedAt: true,
        score: true,
        passed: true,
      },
      orderBy: { completedAt: 'asc' },
    });

    // Group by date
    const trendMap = new Map<
      string,
      { date: string; totalScore: number; count: number; passed: number }
    >();

    for (const inspection of trendInspections) {
      if (!inspection.completedAt) continue;
      const dateKey = inspection.completedAt.toISOString().split('T')[0];
      const existing = trendMap.get(dateKey);

      if (existing) {
        existing.totalScore += inspection.score || 0;
        existing.count += 1;
        if (inspection.passed) existing.passed += 1;
      } else {
        trendMap.set(dateKey, {
          date: dateKey,
          totalScore: inspection.score || 0,
          count: 1,
          passed: inspection.passed ? 1 : 0,
        });
      }
    }

    const trendData = Array.from(trendMap.values())
      .map((entry) => ({
        date: entry.date,
        avgScore: Math.round(entry.totalScore / entry.count),
        totalInspections: entry.count,
        passedInspections: entry.passed,
        passRate: Math.round((entry.passed / entry.count) * 100),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      data: {
        totalInspections,
        passedCount,
        failedCount,
        passRate,
        avgScore: avgScoreResult._avg.score
          ? Math.round(avgScoreResult._avg.score)
          : 0,
        inspectorBreakdown: inspectorStats,
        roomBreakdown,
        trendData,
      },
    });
  } catch (error) {
    console.error('Error fetching inspection stats:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inspection stats' } },
      { status: 500 }
    );
  }
}
