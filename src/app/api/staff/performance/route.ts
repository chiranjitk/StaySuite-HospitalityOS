import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/staff/performance - Get staff performance metrics
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'staff.view') && !hasPermission(user, 'performance.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view staff performance' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);
    const department = searchParams.get('department');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Calculate date threshold
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Math.min(days, 365)); // Cap at 1 year
    startDate.setHours(0, 0, 0, 0);

    const tenantId = user.tenantId;

    // Get all users (staff) with tenant scoping
    const where: Record<string, unknown> = { tenantId, deletedAt: null };
    if (department && department !== 'all') {
      where.department = department;
    }

    const users = await db.user.findMany({
      where,
      include: {
        role: {
          select: { name: true },
        },
      },
      take: Math.min(parseInt(limit || '100', 10), 100),
      skip: parseInt(offset || '0', 10),
    });

    const totalStaff = await db.user.count({ where });

    // Get all tasks for the period with tenant scoping
    const tasks = await db.task.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
    });

    // Calculate stats
    const activeToday = users.filter(u => u.lastLoginAt &&
      new Date(u.lastLoginAt).toDateString() === new Date().toDateString()
    ).length;

    const tasksCompleted = tasks.filter(t => t.status === 'completed').length;

    // Calculate average completion time for completed tasks
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.completedAt);
    let avgResponseTime = 0;
    if (completedTasks.length > 0) {
      const totalTime = completedTasks.reduce((sum, t) => {
        const created = new Date(t.createdAt).getTime();
        const completed = new Date(t.completedAt!).getTime();
        return sum + (completed - created);
      }, 0);
      avgResponseTime = Math.round((totalTime / completedTasks.length) / (1000 * 60)); // in minutes
    }

    // Get attendance records for the period with tenant scoping
    const attendanceRecords = await db.staffAttendance.findMany({
      where: {
        tenantId,
        date: { gte: startDate },
      },
    });

    // Build staff list with performance metrics
    const staffList = users.map(userItem => {
      const userTasks = tasks.filter(t => t.assignedTo === userItem.id);
      const completed = userTasks.filter(t => t.status === 'completed').length;
      const inProgress = userTasks.filter(t => t.status === 'in_progress').length;

      // Calculate average completion time for this user
      const userCompletedTasks = userTasks.filter(t => t.status === 'completed' && t.completedAt);
      let avgCompletionTime = 0;
      if (userCompletedTasks.length > 0) {
        const totalTime = userCompletedTasks.reduce((sum, t) => {
          const created = new Date(t.createdAt).getTime();
          const completedTime = new Date(t.completedAt!).getTime();
          return sum + (completedTime - created);
        }, 0);
        avgCompletionTime = Math.round((totalTime / userCompletedTasks.length) / (1000 * 60));
      }

      // Calculate attendance rate from real attendance records
      const userAttendance = attendanceRecords.filter(a => a.userId === userItem.id);
      const totalDays = userAttendance.length;
      const presentDays = userAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
      const attendance = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100; // Default to 100% if no records

      // Calculate performance score
      const taskScore = completed * 10;
      const timeScore = avgCompletionTime > 0 ? Math.max(0, 100 - avgCompletionTime) : 50;
      const performance = Math.min(100, Math.round((taskScore + timeScore + attendance) / 3));

      // Calculate rating based on performance (3.0 to 5.0 scale)
      const rating = 3.0 + (performance / 100) * 2.0;

      return {
        id: userItem.id,
        name: `${userItem.firstName} ${userItem.lastName}`,
        role: userItem.role?.name || 'Staff',
        department: userItem.department || 'General',
        rating: Math.round(rating * 10) / 10,
        tasksCompleted: completed,
        tasksInProgress: inProgress,
        avgCompletionTime,
        attendance,
        performance,
      };
    });

    // Department stats
    const departments = ['Housekeeping', 'Front Desk', 'Maintenance', 'F&B', 'Security'];
    const departmentStats = departments.map(dept => {
      const deptStaff = staffList.filter(s => s.department === dept);
      const deptTasks = tasks.filter(t =>
        staffList.find(s => s.id === t.assignedTo)?.department === dept
      );

      return {
        department: dept,
        staff: deptStaff.length,
        tasksCompleted: deptTasks.filter(t => t.status === 'completed').length,
        avgRating: deptStaff.length > 0
          ? Math.round(deptStaff.reduce((sum, s) => sum + s.rating, 0) / deptStaff.length * 10) / 10
          : 0,
        efficiency: deptStaff.length > 0
          ? Math.round(deptStaff.reduce((sum, s) => sum + s.performance, 0) / deptStaff.length)
          : 0,
      };
    });

    // Weekly trend (last 7 days)
    const weeklyTrend: Array<{ day: string; completed: number; pending: number; inProgress: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayTasks = tasks.filter(t =>
        new Date(t.createdAt) >= dayStart && new Date(t.createdAt) <= dayEnd
      );

      weeklyTrend.push({
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
        completed: dayTasks.filter(t => t.status === 'completed').length,
        pending: dayTasks.filter(t => t.status === 'pending').length,
        inProgress: dayTasks.filter(t => t.status === 'in_progress').length,
      });
    }

    return NextResponse.json({
      success: true,
      pagination: {
        total: totalStaff,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0,
      },
      data: {
        totalStaff,
        activeToday,
        avgRating: staffList.length > 0
          ? Math.round(staffList.reduce((sum, s) => sum + s.rating, 0) / staffList.length * 10) / 10
          : 0,
        tasksCompleted,
        avgResponseTime,
        staffList: staffList.sort((a, b) => b.performance - a.performance),
        departmentStats: departmentStats.filter(d => d.staff > 0),
        weeklyTrend,
      },
    });
  } catch (error) {
    console.error('Error fetching staff performance:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch staff performance' } },
      { status: 500 }
    );
  }
}
