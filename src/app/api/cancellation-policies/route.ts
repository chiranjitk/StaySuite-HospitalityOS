import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/cancellation-policies — List policies for tenant
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  // RBAC: settings.view or settings.* or admin
  if (
    !hasPermission(user, 'settings.view') &&
    !hasPermission(user, 'bookings.view')
  ) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
      { status: 403 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId') || undefined;
    const ratePlanId = searchParams.get('ratePlanId') || undefined;
    const isActiveParam = searchParams.get('isActive');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Build where clause — always filter by tenantId
    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (ratePlanId) where.ratePlanId = ratePlanId;

    if (!includeInactive) {
      if (isActiveParam === 'false') {
        where.isActive = false;
      } else {
        where.isActive = true;
      }
    } else if (isActiveParam !== null) {
      where.isActive = isActiveParam === 'true';
    }

    const [policies, total] = await Promise.all([
      db.cancellationPolicy.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.cancellationPolicy.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: policies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing cancellation policies:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list cancellation policies' } },
      { status: 500 }
    );
  }
}

// POST /api/cancellation-policies — Create a new policy
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  // RBAC: settings.manage or settings.* or admin
  if (!hasPermission(user, 'settings.manage')) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const {
      name,
      description,
      propertyId,
      ratePlanId,
      freeCancelHoursBefore,
      penaltyPercent,
      noShowPenaltyPercent,
      penaltyType,
      penaltyFixedAmount,
      penaltyNights,
      exceptions,
      isActive,
      sortOrder,
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Policy name is required' } },
        { status: 400 }
      );
    }

    // Validate penaltyType
    const validPenaltyTypes = ['percentage', 'fixed_nights', 'first_night', 'fixed'];
    if (penaltyType && !validPenaltyTypes.includes(penaltyType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid penaltyType. Must be one of: ${validPenaltyTypes.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Validate penaltyFixedAmount is provided when penaltyType is 'fixed'
    if (penaltyType === 'fixed' && (penaltyFixedAmount === undefined || penaltyFixedAmount === null || penaltyFixedAmount < 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'penaltyFixedAmount is required when penaltyType is "fixed"' } },
        { status: 400 }
      );
    }

    // Validate penaltyNights is provided when penaltyType is 'fixed_nights' or 'first_night'
    if (
      (penaltyType === 'fixed_nights' || penaltyType === 'first_night') &&
      (penaltyNights === undefined || penaltyNights === null || penaltyNights < 1)
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `penaltyNights is required and must be >= 1 when penaltyType is "${penaltyType}"` } },
        { status: 400 }
      );
    }

    // If ratePlanId is provided, verify it belongs to the tenant
    if (ratePlanId) {
      const ratePlan = await db.ratePlan.findUnique({
        where: { id: ratePlanId },
      });
      if (!ratePlan || ratePlan.tenantId !== user.tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Rate plan not found' } },
          { status: 404 }
        );
      }
    }

    // If propertyId is provided, verify it belongs to the tenant
    if (propertyId) {
      const property = await db.property.findUnique({
        where: { id: propertyId },
      });
      if (!property || property.tenantId !== user.tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
          { status: 404 }
        );
      }
    }

    // Validate exceptions JSON if provided
    let parsedExceptions = '[]';
    if (exceptions !== undefined) {
      if (typeof exceptions === 'string') {
        try {
          const parsed = JSON.parse(exceptions);
          if (!Array.isArray(parsed)) throw new Error('Must be an array');
          parsedExceptions = JSON.stringify(parsed);
        } catch {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid exceptions format — must be a JSON array' } },
            { status: 400 }
          );
        }
      } else if (Array.isArray(exceptions)) {
        parsedExceptions = JSON.stringify(exceptions);
      }
    }

    const policy = await db.cancellationPolicy.create({
      data: {
        tenantId: user.tenantId,
        name: name.trim(),
        description: description || null,
        propertyId: propertyId || null,
        ratePlanId: ratePlanId || null,
        freeCancelHoursBefore: freeCancelHoursBefore !== undefined ? Number(freeCancelHoursBefore) : 48,
        penaltyPercent: penaltyPercent !== undefined ? Number(penaltyPercent) : 50,
        noShowPenaltyPercent: noShowPenaltyPercent !== undefined ? Number(noShowPenaltyPercent) : 100,
        penaltyType: penaltyType || 'percentage',
        penaltyFixedAmount: penaltyFixedAmount !== undefined ? Number(penaltyFixedAmount) : null,
        penaltyNights: penaltyNights !== undefined ? Number(penaltyNights) : null,
        exceptions: parsedExceptions,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      },
    });

    return NextResponse.json({ success: true, data: policy }, { status: 201 });
  } catch (error) {
    console.error('Error creating cancellation policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create cancellation policy' } },
      { status: 500 }
    );
  }
}
