import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/cancellation-policies/[id] — Get single policy
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    const policy = await db.cancellationPolicy.findUnique({
      where: { id },
    });

    if (!policy) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Cancellation policy not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation
    if (policy.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: policy });
  } catch (error) {
    console.error('Error fetching cancellation policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch cancellation policy' } },
      { status: 500 }
    );
  }
}

// PUT /api/cancellation-policies/[id] — Update a policy (whitelisted fields only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    const body = await request.json();

    // Verify policy exists and belongs to tenant
    const existingPolicy = await db.cancellationPolicy.findUnique({
      where: { id },
    });

    if (!existingPolicy) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Cancellation policy not found' } },
        { status: 404 }
      );
    }

    if (existingPolicy.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
        { status: 404 }
      );
    }

    // Only allow whitelisted fields
    const allowedFields = [
      'name',
      'description',
      'propertyId',
      'ratePlanId',
      'freeCancelHoursBefore',
      'penaltyPercent',
      'noShowPenaltyPercent',
      'penaltyType',
      'penaltyFixedAmount',
      'penaltyNights',
      'exceptions',
      'isActive',
      'sortOrder',
    ] as const;

    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'propertyId' || field === 'ratePlanId') {
          updateData[field] = body[field] || null;
        } else if (field === 'isActive') {
          updateData[field] = Boolean(body[field]);
        } else if (field === 'freeCancelHoursBefore' || field === 'penaltyPercent' || field === 'noShowPenaltyPercent') {
          updateData[field] = Number(body[field]);
        } else if (field === 'penaltyFixedAmount') {
          updateData[field] = body[field] !== null ? Number(body[field]) : null;
        } else if (field === 'penaltyNights') {
          updateData[field] = body[field] !== null ? Number(body[field]) : null;
        } else if (field === 'sortOrder') {
          updateData[field] = Number(body[field]);
        } else if (field === 'exceptions') {
          if (typeof body[field] === 'string') {
            try {
              const parsed = JSON.parse(body[field]);
              if (!Array.isArray(parsed)) throw new Error('Must be an array');
              updateData[field] = JSON.stringify(parsed);
            } catch {
              return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid exceptions format' } },
                { status: 400 }
              );
            }
          } else if (Array.isArray(body[field])) {
            updateData[field] = JSON.stringify(body[field]);
          }
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Validate penaltyType
    const validPenaltyTypes = ['percentage', 'fixed_nights', 'first_night', 'fixed'];
    if (updateData.penaltyType && !validPenaltyTypes.includes(updateData.penaltyType as string)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid penaltyType. Must be one of: ${validPenaltyTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate penaltyFixedAmount for fixed type
    if (updateData.penaltyType === 'fixed' && (updateData.penaltyFixedAmount === undefined || updateData.penaltyFixedAmount === null || Number(updateData.penaltyFixedAmount) < 0)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'penaltyFixedAmount is required when penaltyType is "fixed"' } },
        { status: 400 }
      );
    }

    // Validate penaltyNights
    if (
      (updateData.penaltyType === 'fixed_nights' || updateData.penaltyType === 'first_night') &&
      (updateData.penaltyNights === undefined || updateData.penaltyNights === null || (updateData.penaltyNights as number) < 1)
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `penaltyNights is required and must be >= 1 when penaltyType is "${updateData.penaltyType}"` } },
        { status: 400 }
      );
    }

    // If ratePlanId is being changed, verify it belongs to the tenant
    if (updateData.ratePlanId) {
      const ratePlan = await db.ratePlan.findUnique({
        where: { id: updateData.ratePlanId as string },
      });
      if (!ratePlan || ratePlan.tenantId !== user.tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Rate plan not found' } },
          { status: 404 }
        );
      }
    }

    // If propertyId is being changed, verify it belongs to the tenant
    if (updateData.propertyId) {
      const property = await db.property.findUnique({
        where: { id: updateData.propertyId as string },
      });
      if (!property || property.tenantId !== user.tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
          { status: 404 }
        );
      }
    }

    const policy = await db.cancellationPolicy.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: policy });
  } catch (error) {
    console.error('Error updating cancellation policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update cancellation policy' } },
      { status: 500 }
    );
  }
}

// DELETE /api/cancellation-policies/[id] — Delete a policy
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    // Verify policy exists and belongs to tenant
    const existingPolicy = await db.cancellationPolicy.findUnique({
      where: { id },
    });

    if (!existingPolicy) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Cancellation policy not found' } },
        { status: 404 }
      );
    }

    if (existingPolicy.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
        { status: 404 }
      );
    }

    // Hard delete — cancellation policies are configuration data, not transactional
    await db.cancellationPolicy.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Cancellation policy deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting cancellation policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete cancellation policy' } },
      { status: 500 }
    );
  }
}
