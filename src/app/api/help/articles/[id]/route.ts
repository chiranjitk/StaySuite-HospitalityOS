import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, getUserFromRequest } from '@/lib/auth-helpers';

// GET /api/help/articles/[id] - Get single help article
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {


    const { id } = await params;

    const searchParams = request.nextUrl.searchParams;

    const article = await db.helpArticle.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, error: { message: 'Article not found' } },
        { status: 404 }
      );
    }

    // Increment view count (skip if client signals already counted this session)
    const skipViewCount = searchParams.get('skipViewCount') === 'true';
    if (!skipViewCount) {
      await db.helpArticle.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
    }

    // Parse tags
    const parsedArticle = {
      ...article,
      tags: JSON.parse(article.tags || '[]'),
    };

    return NextResponse.json({
      success: true,
      data: parsedArticle,
    });
  } catch (error) {
    console.error('Error fetching help article:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch help article' } },
      { status: 500 }
    );
  }
}

// PUT /api/help/articles/[id] - Update help article
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {


    // Check permission to manage help articles (allow all authenticated users to submit feedback)
    const body = await request.json();
    const { helpful, notHelpful } = body;

    // If just submitting feedback, allow any authenticated user
    if (helpful !== undefined || notHelpful !== undefined) {
      const { id } = await params;

      const existing = await db.helpArticle.findFirst({
        where: { id, tenantId: user.tenantId },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: { message: 'Article not found' } },
          { status: 404 }
        );
      }

      const updateData: Record<string, unknown> = {};

      if (helpful === true) {
        updateData.helpfulCount = { increment: 1 };
      }
      if (notHelpful === true) {
        updateData.notHelpfulCount = { increment: 1 };
      }

      const article = await db.helpArticle.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({
        success: true,
        data: article,
      });
    }

    // For other updates, require manage permission
    if (!hasPermission(user, 'help:manage')) {
      return NextResponse.json(
        { success: false, error: { message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await db.helpArticle.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: 'Article not found' } },
        { status: 404 }
      );
    }

    const {
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

    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (content !== undefined) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (featuredImage !== undefined) updateData.featuredImage = featuredImage;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (authorId !== undefined) updateData.authorId = authorId;
    if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
    
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'published' && existing.status !== 'published') {
        updateData.publishedAt = new Date();
      }
    }

    const article = await db.helpArticle.update({
      where: { id },
      data: updateData,
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

// DELETE /api/help/articles/[id] - Delete help article
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
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

    const { id } = await params;

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
