import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logGuest } from '@/lib/audit';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/guests/[id] - Get a single guest
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'guests.view') && !hasPermission(user, 'guests.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;
    
    const guest = await db.guest.findUnique({
      where: { id, deletedAt: null },
      include: {
        bookings: {
          where: { deletedAt: null },
          include: {
            room: { select: { number: true } },
            roomType: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        documents: true,
        _count: {
          select: {
            bookings: true,
            reviews: true,
            feedback: true,
          },
        },
      },
    });
    
    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    if (guest.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...guest,
        preferences: JSON.parse(guest.preferences),
        tags: JSON.parse(guest.tags),
        totalBookings: guest._count.bookings,
        totalReviews: guest._count.reviews,
        totalFeedback: guest._count.feedback,
      },
    });
  } catch (error) {
    console.error('Error fetching guest:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch guest' } },
      { status: 500 }
    );
  }
}

// PUT /api/guests/[id] - Update a guest
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'guests.update') && !hasPermission(user, 'guests.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;
    const body = await request.json();
    
    const existingGuest = await db.guest.findUnique({
      where: { id, deletedAt: null },
    });
    
    if (!existingGuest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    if (existingGuest.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }
    
    // Capture old values for audit
    const oldValue = {
      firstName: existingGuest.firstName,
      lastName: existingGuest.lastName,
      email: existingGuest.email,
      phone: existingGuest.phone,
      loyaltyTier: existingGuest.loyaltyTier,
      isVip: existingGuest.isVip,
      kycStatus: existingGuest.kycStatus,
    };
    
    const {
      firstName,
      lastName,
      email,
      phone,
      alternatePhone,
      nationality,
      dateOfBirth,
      gender,
      idType,
      idNumber,
      idExpiry,
      idCountry,
      address,
      city,
      state,
      country,
      postalCode,
      preferences,
      dietaryRequirements,
      specialRequests,
      avatar,
      notes,
      tags,
      loyaltyTier,
      loyaltyPoints,
      totalStays,
      totalSpent,
      isVip,
      vipLevel,
      source,
      sourceId,
      emailOptIn,
      smsOptIn,
      kycStatus,
    } = body;
    
    // If email is being changed, check for conflicts
    if (email && email !== existingGuest.email) {
      const emailConflict = await db.guest.findFirst({
        where: { email: email as string, deletedAt: null },
      });
      
      if (emailConflict) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_EMAIL', message: 'A guest with this email already exists' } },
          { status: 400 }
        );
      }
    }
    
    const guest = await db.guest.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(alternatePhone !== undefined && { alternatePhone }),
        ...(nationality !== undefined && { nationality }),
        ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        ...(gender !== undefined && { gender }),
        ...(idType !== undefined && { idType }),
        ...(idNumber !== undefined && { idNumber }),
        ...(idExpiry !== undefined && { idExpiry: idExpiry ? new Date(idExpiry) : null }),
        ...(idCountry !== undefined && { idCountry }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(country !== undefined && { country }),
        ...(postalCode !== undefined && { postalCode }),
        ...(preferences !== undefined && { preferences: JSON.stringify(preferences) }),
        ...(dietaryRequirements !== undefined && { dietaryRequirements }),
        ...(specialRequests !== undefined && { specialRequests }),
        ...(avatar !== undefined && { avatar }),
        ...(notes !== undefined && { notes }),
        ...(tags !== undefined && { tags: JSON.stringify(tags) }),
        ...(loyaltyTier && { loyaltyTier }),
        ...(loyaltyPoints !== undefined && { loyaltyPoints }),
        ...(totalStays !== undefined && { totalStays }),
        ...(totalSpent !== undefined && { totalSpent }),
        ...(isVip !== undefined && { isVip }),
        ...(vipLevel !== undefined && { vipLevel }),
        ...(source !== undefined && { source }),
        ...(sourceId !== undefined && { sourceId }),
        ...(emailOptIn !== undefined && { emailOptIn }),
        ...(smsOptIn !== undefined && { smsOptIn }),
        ...(kycStatus && { kycStatus }),
      },
    });
    
    // Log guest update
    try {
      await logGuest(request, 'update', guest.id, oldValue, {
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone,
        loyaltyTier: guest.loyaltyTier,
        isVip: guest.isVip,
        kycStatus: guest.kycStatus,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: {
        ...guest,
        preferences: JSON.parse(guest.preferences),
        tags: JSON.parse(guest.tags),
      }
    });
  } catch (error) {
    console.error('Error updating guest:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update guest' } },
      { status: 500 }
    );
  }
}

// DELETE /api/guests/[id] - Soft delete a guest
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'guests.delete') && !hasPermission(user, 'guests.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;
    
    const existingGuest = await db.guest.findUnique({
      where: { id, deletedAt: null },
      include: {
        bookings: {
          where: {
            status: { in: ['confirmed', 'checked_in'] },
          },
        },
      },
    });
    
    if (!existingGuest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    if (existingGuest.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }
    
    // Check if guest has active bookings
    if (existingGuest.bookings.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'HAS_BOOKINGS', message: 'Cannot delete guest with active bookings' } },
        { status: 400 }
      );
    }
    
    // Capture old values for audit
    const oldValue = {
      firstName: existingGuest.firstName,
      lastName: existingGuest.lastName,
      email: existingGuest.email,
      phone: existingGuest.phone,
    };
    
    // Soft delete
    await db.guest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    
    // Log guest deletion
    try {
      await logGuest(request, 'delete', id, oldValue, undefined, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }
    
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting guest:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete guest' } },
      { status: 500 }
    );
  }
}
