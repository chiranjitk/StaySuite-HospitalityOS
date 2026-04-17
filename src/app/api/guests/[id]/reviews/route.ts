import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

// GET /api/guests/[id]/reviews - Get guest reviews
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const tenantId = await getTenantIdFromSession(request);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {
    const { id } = await params;

    // Verify guest belongs to tenant
    const guest = await db.guest.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }
    
    const reviews = await db.guestReview.findMany({
      where: { guestId: id },
      include: {
        property: {
          select: { name: true, city: true }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Calculate average ratings
    const avgRatings = {
      overall: reviews.length > 0 
        ? reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length 
        : 0,
      cleanliness: reviews.filter(r => r.cleanlinessRating).length > 0
        ? reviews.filter(r => r.cleanlinessRating).reduce((sum, r) => sum + (r.cleanlinessRating || 0), 0) / reviews.filter(r => r.cleanlinessRating).length
        : 0,
      service: reviews.filter(r => r.serviceRating).length > 0
        ? reviews.filter(r => r.serviceRating).reduce((sum, r) => sum + (r.serviceRating || 0), 0) / reviews.filter(r => r.serviceRating).length
        : 0,
      location: reviews.filter(r => r.locationRating).length > 0
        ? reviews.filter(r => r.locationRating).reduce((sum, r) => sum + (r.locationRating || 0), 0) / reviews.filter(r => r.locationRating).length
        : 0,
      value: reviews.filter(r => r.valueRating).length > 0
        ? reviews.filter(r => r.valueRating).reduce((sum, r) => sum + (r.valueRating || 0), 0) / reviews.filter(r => r.valueRating).length
        : 0,
    };
    
    return NextResponse.json({
      success: true,
      data: reviews,
      summary: {
        totalReviews: reviews.length,
        avgRatings,
      },
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch reviews' } },
      { status: 500 }
    );
  }
}
