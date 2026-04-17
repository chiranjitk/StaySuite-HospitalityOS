import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { hasPermission, getUserFromRequest } from '@/lib/auth-helpers';

// GET /api/help/categories - List help categories
export async function GET(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {


    const searchParams = request.nextUrl.searchParams;
    const parentId = searchParams.get('parentId');

    const where: Prisma.HelpCategoryWhereInput = {
      ...(parentId === 'null' ? { parentId: null } : parentId ? { parentId } : {}),
    };

    const categories = await db.helpCategory.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { children: true },
        },
      },
    });

    // Get article count per category for this tenant
    const articleCounts = await db.helpArticle.groupBy({
      by: ['category'],
      _count: {
        id: true,
      },
      where: {
        status: 'published',
        tenantId: user.tenantId,
      },
    });

    const articleCountMap = articleCounts.reduce((acc, item) => {
      acc[item.category] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Transform categories with article counts
    const categoriesWithCounts = categories.map((cat) => ({
      ...cat,
      articleCount: articleCountMap[cat.slug] || 0,
    }));

    return NextResponse.json({
      success: true,
      data: categoriesWithCounts,
    });
  } catch (error) {
    console.error('Error fetching help categories:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch help categories' } },
      { status: 500 }
    );
  }
}

// POST /api/help/categories - Create a new help category
export async function POST(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {


    if (!hasPermission(user, 'help:manage')) {
      return NextResponse.json(
        { success: false, error: { message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      slug,
      description,
      icon,
      sortOrder = 0,
      parentId,
    } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: { message: 'Name and slug are required' } },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { success: false, error: { message: 'Slug must contain only lowercase letters, numbers, and hyphens' } },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existingSlug = await db.helpCategory.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      return NextResponse.json(
        { success: false, error: { message: 'A category with this slug already exists' } },
        { status: 400 }
      );
    }

    // If parentId is provided, check if parent exists
    if (parentId) {
      const parent = await db.helpCategory.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        return NextResponse.json(
          { success: false, error: { message: 'Parent category not found' } },
          { status: 404 }
        );
      }
    }

    const category = await db.helpCategory.create({
      data: {
        name,
        slug,
        description,
        icon,
        sortOrder,
        parentId: parentId || null,
      },
      include: {
        children: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Error creating help category:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create help category' } },
      { status: 500 }
    );
  }
}

// PUT /api/help/categories - Update help category
export async function PUT(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {


    if (!hasPermission(user, 'help:manage')) {
      return NextResponse.json(
        { success: false, error: { message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      id,
      name,
      slug,
      description,
      icon,
      sortOrder,
      parentId,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'Category ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.helpCategory.findFirst({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: 'Category not found' } },
        { status: 404 }
      );
    }

    // Check slug uniqueness if changing
    if (slug && slug !== existing.slug) {
      const slugExists = await db.helpCategory.findUnique({
        where: { slug },
      });
      if (slugExists) {
        return NextResponse.json(
          { success: false, error: { message: 'A category with this slug already exists' } },
          { status: 400 }
        );
      }
    }

    // Prevent setting parent to self
    if (parentId === id) {
      return NextResponse.json(
        { success: false, error: { message: 'Category cannot be its own parent' } },
        { status: 400 }
      );
    }

    const category = await db.helpCategory.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(parentId !== undefined && { parentId: parentId || null }),
      },
      include: {
        children: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Error updating help category:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update help category' } },
      { status: 500 }
    );
  }
}

// DELETE /api/help/categories - Delete help category
export async function DELETE(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {


    if (!hasPermission(user, 'help:manage')) {
      return NextResponse.json(
        { success: false, error: { message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'Category ID is required' } },
        { status: 400 }
      );
    }

    const category = await db.helpCategory.findFirst({
      where: { id },
      include: {
        children: true,
      },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: { message: 'Category not found' } },
        { status: 404 }
      );
    }

    // Check if category has children
    if (category.children.length > 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Cannot delete category with subcategories' } },
        { status: 400 }
      );
    }

    // Check if category has articles (for this tenant)
    const articlesCount = await db.helpArticle.count({
      where: {
        category: category.slug,
        tenantId: user.tenantId,
      },
    });

    if (articlesCount > 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Cannot delete category with articles' } },
        { status: 400 }
      );
    }

    await db.helpCategory.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Category deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting help category:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete help category' } },
      { status: 500 }
    );
  }
}
