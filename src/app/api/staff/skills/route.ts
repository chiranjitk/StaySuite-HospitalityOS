import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { Prisma } from '@prisma/client';

// GET /api/staff/skills - List skills (filter by userId, category, or list all for property)
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'staff.view') && !hasPermission(user, 'staff.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');
    const certifiedOnly = searchParams.get('certified') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (userId) {
      where.userId = userId;
    }

    if (category) {
      where.category = category;
    }

    if (certifiedOnly) {
      where.certified = true;
    }

    const skills = await db.staffSkill.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            jobTitle: true,
            avatar: true,
          },
        },
      },
      orderBy: [{ category: 'asc' }, { skillName: 'asc' }],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.staffSkill.count({ where });

    // Aggregate stats
    const categoryCounts = await db.staffSkill.groupBy({
      by: ['category'],
      where: { tenantId: user.tenantId },
      _count: { id: true },
    });

    const certifiedCount = await db.staffSkill.count({
      where: { tenantId: user.tenantId, certified: true },
    });

    return NextResponse.json({
      success: true,
      data: skills,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        byCategory: categoryCounts.reduce((acc, item) => {
          acc[item.category] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        certified: certifiedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching staff skills:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch staff skills' } },
      { status: 500 }
    );
  }
}

// POST /api/staff/skills - Create or update (upsert) a staff skill by userId + skillName
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'staff.manage') && !hasPermission(user, 'staff.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions to manage staff skills' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      userId,
      skillName,
      skillLevel = 1,
      category = 'general',
      certified = false,
      certifiedAt,
      certifiedBy,
      notes,
    } = body;

    // Validate required fields
    if (!userId || !skillName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'User ID and skill name are required' } },
        { status: 400 }
      );
    }

    // Validate skillLevel
    if (skillLevel < 1 || skillLevel > 5) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Skill level must be between 1 and 5' } },
        { status: 400 }
      );
    }

    // Verify the target user belongs to the same tenant
    const targetUser = await db.user.findFirst({
      where: { id: userId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_USER', message: 'Staff member not found or does not belong to your tenant' } },
        { status: 400 }
      );
    }

    // Upsert: create or update by userId + skillName unique constraint
    const skill = await db.staffSkill.upsert({
      where: {
        userId_skillName: {
          userId,
          skillName,
        },
      },
      update: {
        skillLevel,
        category,
        certified,
        certifiedAt: certified ? (certifiedAt ? new Date(certifiedAt) : new Date()) : null,
        certifiedBy: certified ? (certifiedBy || user.id) : null,
        notes,
      },
      create: {
        tenantId: user.tenantId,
        userId,
        skillName,
        skillLevel,
        category,
        certified,
        certifiedAt: certified ? (certifiedAt ? new Date(certifiedAt) : new Date()) : null,
        certifiedBy: certified ? (certifiedBy || user.id) : null,
        notes,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            jobTitle: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: skill }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'This skill already exists for this staff member' } },
        { status: 409 }
      );
    }
    console.error('Error creating/updating staff skill:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create/update staff skill' } },
      { status: 500 }
    );
  }
}

// DELETE /api/staff/skills - Remove a staff skill
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'staff.manage') && !hasPermission(user, 'staff.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions to manage staff skills' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    const skillName = searchParams.get('skillName');

    // Delete by ID
    if (id) {
      const skill = await db.staffSkill.findFirst({
        where: { id, tenantId: user.tenantId },
      });

      if (!skill) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Skill not found' } },
          { status: 404 }
        );
      }

      await db.staffSkill.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Skill deleted successfully' });
    }

    // Delete by userId + skillName
    if (userId && skillName) {
      const skill = await db.staffSkill.findFirst({
        where: { userId, skillName, tenantId: user.tenantId },
      });

      if (!skill) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Skill not found' } },
          { status: 404 }
        );
      }

      await db.staffSkill.delete({ where: { id: skill.id } });
      return NextResponse.json({ success: true, message: 'Skill deleted successfully' });
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Either skill ID or userId + skillName are required' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error deleting staff skill:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete staff skill' } },
      { status: 500 }
    );
  }
}
