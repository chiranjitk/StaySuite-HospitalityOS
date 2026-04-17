import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logGuest } from '@/lib/audit';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/guests - List all guests
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'guests.view') && !hasPermission(user, 'guests.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const loyaltyTier = searchParams.get('loyaltyTier');
    const isVip = searchParams.get('isVip');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (status) {
      where.kycStatus = status;
    }

    if (loyaltyTier) {
      where.loyaltyTier = loyaltyTier;
    }

    if (isVip === 'true') {
      where.isVip = true;
    }

    const guests = await db.guest.findMany({
      where,
      include: {
        _count: {
          select: {
            bookings: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.guest.count({ where });

    return NextResponse.json({
      success: true,
      data: guests.map((g) => ({
        ...g,
        preferences: JSON.parse(g.preferences),
        tags: JSON.parse(g.tags),
        totalBookings: g._count.bookings,
      })),
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching guests:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch guests' } },
      { status: 500 }
    );
  }
}

// POST /api/guests - Create a new guest
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'guests.create') && !hasPermission(user, 'guests.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const tenantId = user.tenantId;

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
      preferences = {},
      dietaryRequirements,
      specialRequests,
      avatar,
      notes,
      tags = [],
      loyaltyTier = 'bronze',
      loyaltyPoints = 0,
      isVip = false,
      vipLevel,
      source = 'direct',
      sourceId,
      emailOptIn = false,
      smsOptIn = false,
    } = body;

    // Validate required fields
    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'First name and last name are required' } },
        { status: 400 }
      );
    }

    // Check if email already exists within tenant
    if (email) {
      const existingGuest = await db.guest.findFirst({
        where: { email, tenantId, deletedAt: null },
      });

      if (existingGuest) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_EMAIL', message: 'A guest with this email already exists in your tenant' } },
          { status: 400 }
        );
      }
    }

    const guest = await db.guest.create({
      data: {
        tenantId,
        firstName,
        lastName,
        email,
        phone,
        alternatePhone,
        nationality,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        idType,
        idNumber,
        idExpiry: idExpiry ? new Date(idExpiry) : null,
        idCountry,
        address,
        city,
        state,
        country,
        postalCode,
        preferences: JSON.stringify(preferences),
        dietaryRequirements,
        specialRequests,
        avatar,
        notes,
        tags: JSON.stringify(tags),
        loyaltyTier,
        loyaltyPoints,
        isVip,
        vipLevel,
        source,
        sourceId,
        emailOptIn,
        smsOptIn,
      },
    });

    // Log guest creation
    try {
      await logGuest(request, 'create', guest.id, undefined, {
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone,
        source: guest.source,
        isVip: guest.isVip,
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
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating guest:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create guest' } },
      { status: 500 }
    );
  }
}
