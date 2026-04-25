import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { hasPermission, getUserFromRequest } from '@/lib/auth-helpers';

// GET /api/help/articles - List help articles
export async function GET(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {


    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const status = searchParams.get('status') || 'published';
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Use authenticated user's tenant ID
    const tenantId = user.tenantId;

    const where = {
      tenantId,
      ...(category && { category }),
      status,
      ...(search ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { excerpt: { contains: search, mode: 'insensitive' as const } },
          { content: { contains: search, mode: 'insensitive' as const } },
        ],
      } : undefined),
    } as Prisma.HelpArticleWhereInput;

    const [articles, total] = await Promise.all([
      db.helpArticle.findMany({
        where,
        orderBy: [
          { category: 'asc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      db.helpArticle.count({ where }),
    ]);

    // Get stats using aggregation queries instead of fetching all records
    const [totalCount, publishedCount, draftCount, viewAggregates, helpfulAggregates, distinctCategories] = await Promise.all([
      db.helpArticle.count({ where: { tenantId } }),
      db.helpArticle.count({ where: { tenantId, status: 'published' } }),
      db.helpArticle.count({ where: { tenantId, status: 'draft' } }),
      db.helpArticle.aggregate({
        where: { tenantId },
        _sum: { viewCount: true },
      }),
      db.helpArticle.aggregate({
        where: { tenantId },
        _sum: { helpfulCount: true, notHelpfulCount: true },
      }),
      db.helpArticle.groupBy({
        by: ['category'],
        where: { tenantId },
      }),
    ]);

    const stats = {
      total: totalCount,
      published: publishedCount,
      draft: draftCount,
      totalViews: viewAggregates._sum.viewCount || 0,
      totalHelpful: (helpfulAggregates._sum.helpfulCount || 0) + (helpfulAggregates._sum.notHelpfulCount || 0),
      categories: distinctCategories.map((c) => c.category),
    };

    // Group articles by category
    const groupedArticles = articles.reduce((acc, article) => {
      if (!acc[article.category]) {
        acc[article.category] = [];
      }
      acc[article.category].push(article);
      return acc;
    }, {} as Record<string, typeof articles>);

    return NextResponse.json({
      success: true,
      data: {
        articles,
        groupedArticles,
        total,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching help articles:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch help articles' } },
      { status: 500 }
    );
  }
}

// POST /api/help/articles - Create a new help article
export async function POST(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {


    // Check permission to manage help articles
    if (!hasPermission(user, 'help:manage')) {
      return NextResponse.json(
        { success: false, error: { message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      slug,
      content,
      excerpt,
      category,
      tags = [],
      featuredImage,
      videoUrl,
      status = 'draft',
      authorId,
      metaTitle,
      metaDescription,
    } = body;

    if (!title || !slug || !content || !category) {
      return NextResponse.json(
        { success: false, error: { message: 'Title, slug, content, and category are required' } },
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

    // Check if slug already exists for this tenant
    const existingSlug = await db.helpArticle.findFirst({
      where: { slug, tenantId: user.tenantId },
    });

    if (existingSlug) {
      return NextResponse.json(
        { success: false, error: { message: 'An article with this slug already exists' } },
        { status: 400 }
      );
    }

    const article = await db.helpArticle.create({
      data: {
        tenantId: user.tenantId,
        title,
        slug,
        content,
        excerpt,
        category,
        tags: JSON.stringify(tags),
        featuredImage,
        videoUrl,
        status,
        authorId: authorId || user.id,
        metaTitle,
        metaDescription,
        publishedAt: status === 'published' ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error('Error creating help article:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create help article' } },
      { status: 500 }
    );
  }
}

// PUT /api/help/articles - Update help article
export async function PUT(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {


    // Check permission to manage help articles
    if (!hasPermission(user, 'help:manage')) {
      return NextResponse.json(
        { success: false, error: { message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      id,
      title,
      slug,
      content,
      excerpt,
      category,
      tags,
      featuredImage,
      videoUrl,
      status,
      authorId,
      metaTitle,
      metaDescription,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'Article ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.helpArticle.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: 'Article not found' } },
        { status: 404 }
      );
    }

    // Check slug uniqueness if changing
    if (slug && slug !== existing.slug) {
      const slugExists = await db.helpArticle.findFirst({
        where: { slug, tenantId: user.tenantId },
      });
      if (slugExists) {
        return NextResponse.json(
          { success: false, error: { message: 'An article with this slug already exists' } },
          { status: 400 }
        );
      }
    }

    const article = await db.helpArticle.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(slug && { slug }),
        ...(content && { content }),
        ...(excerpt !== undefined && { excerpt }),
        ...(category && { category }),
        ...(tags && { tags: JSON.stringify(tags) }),
        ...(featuredImage !== undefined && { featuredImage }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(status && {
          status,
          publishedAt: status === 'published' && existing.status !== 'published' ? new Date() : existing.publishedAt,
        }),
        ...(authorId !== undefined && { authorId }),
        ...(metaTitle !== undefined && { metaTitle }),
        ...(metaDescription !== undefined && { metaDescription }),
      },
    });

    return NextResponse.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error('Error updating help article:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update help article' } },
      { status: 500 }
    );
  }
}

// DELETE /api/help/articles - Delete help article
export async function DELETE(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {


    // Check permission to manage help articles
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
        { success: false, error: { message: 'Article ID is required' } },
        { status: 400 }
      );
    }

    const article = await db.helpArticle.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, error: { message: 'Article not found' } },
        { status: 404 }
      );
    }

    await db.helpArticle.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Article deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting help article:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete help article' } },
      { status: 500 }
    );
  }
}
